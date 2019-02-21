importScripts('//cdnjs.cloudflare.com/ajax/libs/ramda/0.25.0/ramda.min.js')

onmessage = function(e) {
  if (e.data.init) {
    global.state = init(e.data.init.options)
  }
  if (e.data.start) {
    global.state = start(e.data.start.options)
  }
  else if (e.data.pause) {
    pause(global.state)
  }
  else if (e.data.resume) {
    resume(global.state)
  }
}

if (typeof global === 'undefined') {
    var global = {}
}

const DEFAULT_SETTINGS = {
    // Parameters
    digit: 5,
    countLimit: 4,
    symbols: ['+', '-', '×', '÷', '()'],
    allowConcatenation: true,
    // Display
    displayLimit: 100,
    quiet: false,
    heartbeatSeconds: 1,
    statusSeconds: 1,
    // Internals
    allSymbols: ['+', '-', '×', '÷', '()', '.', '^', '!', '√'],
    valueLimit: 10000,
    allowFractions: true,
    // Timing
    yieldSeconds: 2,
    maxDurationSeconds: 30,
    minHeartbeats: 1
}


////////////////////

function init(settings) {
    global.settings = buildSettings(settings)
}

function start(settings) {
    global.settings = buildSettings(settings)
    const state = buildInitialState()
    scheduleContinue(state)
    return state
}

function pause(state) {
    state.pause = true
}

function resume(state) {
    state.pause = false
    showMessage('Resuming')
    scheduleContinue(state)
}

function scheduleContinue(state) {
    setTimeout(doContinue, 0, state)
}

function doContinue(state) { 
    try {
        if (state.pause) {
            throw 'pause'
        }
        while (true) {
            doRound(state)
            state.lastMilestone = { round: state.lastMilestone.round + 1 }
        }
    }
    catch (ex) {
        if (ex === 'yield') {
            showMessage('Yielding')
            scheduleContinue(state)
        }
        else if (ex === 'pause') {
            showMessage('Pausing')
        }
        else if (ex === 'windup') {
            showMessage('Winding up')
            windup(state)
            showMessage('Finished')
            showFormulas(state.universe)
        }
        else if (ex === 'done') {
            showMessage('Finished')
            showFormulas(state.universe)
        }
        else {
            throw ex
        }
    }
}

function windup(state) {
    showSnapshot(state, 'Windup')
}

function buildSettings(settings) {
    settings = {
        ...DEFAULT_SETTINGS,
        ...settings,
    }
    settings = {
        ...settings,
        allowParens: settings.symbols.includes('()'),
        heartbeatMs: settings.heartbeatSeconds * 1000,
        yieldMs: settings.yieldSeconds * 1000
    }
    // Post basic settings
    postMessage({
        settings: settings
    })
    // Derive more internal settings, which can't be posted
    const operators = allOperators.filter(operator => settings.symbols.includes(operator.symbol))
    settings = {
        ...settings,
        operators,
        unaryOperators: operators.filter(op => op instanceof UnaryOperator),
        binaryOperators: operators.filter(op => op instanceof CommutativeOperator ||  op instanceof NoncommutativeOperator)
    }
    return settings
}

function buildInitialState() {
    const state = {
        lastMilestone: { round: 0 },
        startTimestamp: new Date().getTime(),
        universe: {}
    }

    addNumbers(state.universe, [{
            value: global.settings.digit,
            formula: String(global.settings.digit),
            operator: null,
            count: 1
        }
    ])
    if (global.settings.allowConcatenation) {
        addNumbers(state.universe, [{
                value: global.settings.digit*10 + global.settings.digit,
                formula: String(global.settings.digit*10 + global.settings.digit),
                operator: null,
                count: 2
            },
            {
                value: global.settings.digit*100 + global.settings.digit*10 + global.settings.digit,
                formula: String(global.settings.digit*100 + global.settings.digit*10 + global.settings.digit),
                operator: null,
                count: 3
            }
        ])
    }
    if (global.settings.symbols.includes('.')) {
        addNumbers(state.universe, [{
                value: global.settings.digit/10,
                formula: '.' + global.settings.digit,
                operator: null,
                count: 1
            }
        ])
    }
    return state
}

function doRound(state) {
    const {lastMilestone, universe} = state
    // Set base universe for calculations in this round (universe will grow but baseUniverse won't)
    if (!state.baseUniverse) {
        state.baseUniverse = Object.assign({}, universe)
    }
    const {baseUniverse} = state
    const baseIdList = Object.keys(baseUniverse)
    const baseIdCount = baseIdList.length

    if ( ! lastMilestone.stage) {
        const unaryResults = []
        for (let i = 0; i < baseIdCount; ++i) {
            unaryResults.push(...R.flatten(applyOperators(global.settings.unaryOperators)(baseUniverse[baseIdList[i]])))
        }
        addNumbers(universe, unaryResults)
        lastMilestone.stage = { unary: true }
        heartbeat(state)
        showMilestone(state)
    }

    if (lastMilestone.stage.unary || lastMilestone.stage.binary) {
        let initial_i = lastMilestone.stage.binary ? lastMilestone.stage.binary.i : 0
        let initial_j = lastMilestone.stage.binary ? lastMilestone.stage.binary.j : 0
        let i = initial_i
        initial_i = 0
        for ( ; i < baseIdCount; ++i) {
            const binaryResults = []
            let j = initial_j
            initial_j = 0
            for ( ; j <= i; ++j) {
                binaryResults.push(...R.flatten(applyOperators(global.settings.binaryOperators)(baseUniverse[baseIdList[i]], baseUniverse[baseIdList[j]])))
            }
            addNumbers(universe, binaryResults)
            lastMilestone.stage = {binary: {i, j, fraction: (i + 1) / baseIdCount}}
            heartbeat(state)
        }
        showMilestone(state)
    }

    // Finished the round: reset the base for next time
    state.baseUniverse = null

    const newIdCount = Object.keys(universe).length
    if (newIdCount === baseIdCount) {
        // No new numbers discovered
        lastMilestone.stage = {done: true}
        throw 'done'
    }
}

function applyOperators(operators) {
    return function(numA, numB) {
        return operators.map(op => op.applyAll(numA, numB))
    }
}


///// Utilities


function timestamp() {
    return (new Date().getTime() - global.state.startTimestamp) / 1000
}

function makeId(num) {
    return Math.round(1e6 * (num.value === undefined ? num : num.value))
}


///// Universe


function getNaturals(universe) {
    return Object.keys(universe)
        .map(key => universe[key])
        .filter(num => num.value === Math.trunc(num.value) && 0 < num.value)
}

// nums is an array or a singleton
function addNumbers(universe, nums) {
    const numArray = Array.isArray(nums) ? nums : [nums]
    // add nums that qualify, generate ids
    numArray.forEach(num => {
        if (num
                && (global.settings.allowFractions || num.value === Math.round(num.value))
                && (global.settings.allowParens || ! num.formula.includes('('))
                && num.value < global.settings.valueLimit && - global.settings.valueLimit <= num.value
                && num.count <= global.settings.countLimit) {
            const id = makeId(num)
            if (universe[id]) {
                // replace complicated nums with simpler ones
                const old = universe[id]
                if (num.count < old.count
                    || num.count === old.count && num.formula.length < old.formula.length) {
                        num.id = id
                        universe[id] = num
                }
            }
            else {
                num.id = id
                universe[id] = num
            }
        }
    })
}

const EPSILON = 1e-9

function quantise(number) {
    const integer = Math.round(number)
    const delta = Math.abs(number - integer)
    return (delta < EPSILON ? integer : number)
}


///// Output


function showMilestone(state) {
    const time = timestamp()
    const label = getLabel(state)
    const naturals = R.map(R.path(['value']))(getNaturals(state.universe))
    const numberCount = Object.keys(state.universe).length
    console.log(`Milestone [${label}]`, naturals)
    console.log(time, label , 'Naturals', naturals.length, 'Total', numberCount)
    postMessage({
      snapshot: {
        time,
        label,
        naturals,
        naturalsCount: naturals.length,
        numberCount
      }})
}

function showSnapshot(state, label = getLabel(state)) {
    const time = timestamp()
    const naturalsCount = getNaturals(state.universe).length
    const numberCount = Object.keys(state.universe).length
    console.log(time, label , 'Naturals', naturalsCount, 'Total', numberCount)
    postMessage({
      snapshot: {
        time,
        label,
        naturalsCount,
        numberCount
      }})
}

function showMessage(message) {
    postMessage({
        message
    })
}

function showFormulas(universe, label) {
    const time = timestamp()
    const numberCount = Object.keys(universe).length
    const naturals = getNaturals(universe)
    const formulaMap = {}
    naturals.forEach(({value, formula}) => formulaMap[value] = formula)

    console.log(time, label , 'Naturals', naturals.length, 'Total', numberCount)
    postMessage({
      snapshot: {
        time,
        label,
        formulaMap,
        naturalsCount: naturals.length,
        numberCount
      }})
}

function showDebug(universe, label) {
    const sortedNaturals = getNaturals(universe)
        .sort((a, b) => a.value - b.value)
    console.log(timestamp(), label + '\n', sortedNaturals.map(num => num.value + ' = ' + num.formula).join('\n '))
    console.log('(objects)', sortedNaturals)
    console.log('(all)', Object.keys(universe)
        .map(key => universe[key])
        .map(num => num.value)
        .sort((a, b) => a - b))
}

function getLabel(state) {
    const currentRound = state.lastMilestone.round + 1
    const stage = state.lastMilestone.stage.unary ? 'unary'
            : state.lastMilestone.stage.binary ? 'binary ' + Math.round(state.lastMilestone.stage.binary.fraction * 100) + '%'
            : ''
    return `Round ${currentRound} ${stage}`
}

// Check progress, write a heartbeat log periodically.
function heartbeat(state) {
    const now = new Date().getTime()
    const startTimestamp = state.startTimestamp
    const {heartbeatMs, yieldMs} = global.settings
    const elapsed = now - startTimestamp

    if ( ! state.nextHeartbeat) {
        state.nextHeartbeat = 1
    }
    const nextHeartbeatTimestamp = startTimestamp + heartbeatMs * state.nextHeartbeat
    if (nextHeartbeatTimestamp < now) {
        showSnapshot(state)
        state.nextHeartbeat = Math.ceil((elapsed) / heartbeatMs)
        // If we've done enough heartbeats, check if we need to wind up
        if (global.settings.minHeartbeats < state.nextHeartbeat) {
            if (state.nextHeartbeat * global.settings.heartbeatSeconds > global.settings.maxDurationSeconds) {
                // We should windup before next heartbeat
                throw 'windup'
            }
        }
    }
    if ( ! state.nextYield) {
        state.nextYield = 1
    }
    const nextYieldTimestamp = startTimestamp + yieldMs * state.nextYield
    if (nextYieldTimestamp < now) {
        state.nextYield = Math.ceil((elapsed) / yieldMs)
        throw 'yield'
    }
}


///// Operators


// Compare two operators' precedence, return -ve, 0 or +ve
function opCmp(opA, opB) {
    return ((opA ? opA.precedence : null) || 99) - ((opB ? opB.precedence : null) || 99)
}

// Return the formula for the num with brackets added if necessary
// to bind loosely with the given operator
function bindLoose(operator, num) {
    return opCmp(num.operator, operator) < 0 ? `(${num.formula})` : num.formula
}
// Return the formula for the num with brackets added if necessary
// to bind tightly with the given operator
function bindTight(operator, num) {
    return opCmp(num.operator, operator) <= 0 ? `(${num.formula})` : num.formula
}


///// Operators


class Operator {
    constructor(source) {
        Object.assign(this, source)
    }
}

class UnaryOperator extends Operator {
    apply(numA) {
        const value = this.applyValue(numA)
        return value === null ? null : {
            value,
            formula: this.applyFormula(numA),
            operator: this,
            count: numA.count
        }
    }
    applyAll(numA) {
        return [this.apply(numA)]
    }
}

class NoncommutativeOperator extends Operator {
    apply(numA, numB) {
        const value = quantise(this.applyValues(numA, numB))
        return value === null ? null : {
            value,
            formula: this.applyFormulas(numA, numB),
            operator: this,
            count: numA.count + numB.count
        }
    }
    applyAll(numA, numB) {
        return [this.apply(numA, numB), this.apply(numB, numA)]
    }
}

class CommutativeOperator extends Operator {
    apply(numA, numB) {
        return {
            value: quantise(this.applyValues(numA, numB)),
            formula: this.applyFormulas(numA, numB),
            operator: this,
            count: numA.count + numB.count
        }
    }
    applyAll(numA, numB) {
        return [this.apply(numA, numB)]
    }
}

const add = new CommutativeOperator({
    symbol: '+',
    precedence: 1,
    applyValues(numA, numB) { return numA.value + numB.value },
    applyFormulas(numA, numB) { return bindLoose(this, numA) + '+' + bindLoose(this, numB) }
})

const multiply = new CommutativeOperator({
    symbol: '×',
    precedence: 2,
    applyValues(numA, numB) { return numA.value * numB.value },
    applyFormulas(numA, numB) { return bindLoose(this, numA) + '×' + bindLoose(this, numB) }
})

const subtract = new NoncommutativeOperator({
    symbol: '-',
    precedence: 1,
    applyValues(numA, numB) { return numA.value - numB.value },
    applyFormulas(numA, numB) { return bindLoose(this, numA) + '-' + bindTight(this, numB) }
})

const divide = new NoncommutativeOperator({
    symbol: '÷',
    precedence: 2,
    applyValues(numA, numB) { return numB.value ? numA.value / numB.value : null },
    applyFormulas(numA, numB) { return bindLoose(this, numA) + '÷' + bindTight(this, numB) }
})

const power = new NoncommutativeOperator({
    symbol: '^',
    precedence: 3,
    applyValues(numA, numB) {
        const value = Math.pow(numA.value, numB.value)
        return value < global.settings.valueLimit ? value : null
    },
    applyFormulas(numA, numB) { return bindTight(this, numA) + '^' + bindLoose(this, numB) }
})

const squareRoot = new UnaryOperator({
    symbol: '√',
    precedence: 4,
    applyValue(numA) { return numA.value >= 0 ? Math.sqrt(numA.value) : null },
    applyFormula(numA) { return '√' + bindLoose(this, numA) }
})

const factorial = new UnaryOperator({
    symbol: '!',
    precedence: 5,
    applyValue(numA) { return this.values[numA.value] || null },
    applyFormula(numA) { return bindLoose(this, numA) + '!' },
    values: {3: 6, 4: 24, 5: 120, 6: 720, 7: 5040, 8: 40320, 9: 362880},
})

const negate = new UnaryOperator({
    symbol: '-',
    precedence: 6,
    applyValue(numA) { return -numA.value },
    applyFormula(numA) { return '-' + bindLoose(this, numA) }
})

const allOperators = [add, subtract, multiply, divide, factorial, negate, power, squareRoot]


/////
