import React from 'react';

export default ({ state }) => (
    <div className="status">
        <h2>Num, num</h2>
        {state.settings &&
            <p>Making numbers with {state.settings.requireExactCount ? 'exactly' : 'up to'}{' '}
                {state.settings.countMax} {state.settings.digit}s
                (concatenation {state.settings.allowConcatenation ? '' : 'not '}allowed)
                and symbols {state.settings.symbols.join(' ')}{' '}
                for {state.settings.maxDurationSeconds} seconds
            </p>
        }
        <h2>Status</h2>
        <div>Elapsed time: {(state.snapshot.time || 0).toFixed(1)} seconds</div>
        <div>Current task: <strong>{state.snapshot.label}</strong></div>
        <div>Checked {state.snapshot.numberCount || 'no'} numbers</div>
        <div>Found {state.snapshot.answerCount ? <b>{state.snapshot.answerCount}</b> : 'no'} answers</div>
        {state.snapshot.formulaMap &&
            <div>
                <h2>Results</h2>
                <ul className="results">
                    {getFormulasList(state.snapshot.formulaMap, state.settings.displayLimit).map(
                        ({value, formula}) => (<li key={value}>{value}: {formula}</li>))
                    }
                </ul>
            </div>
        }
    </div>
);

function getFormulasList(formulaMap, displayLimit) {
    const nums = []
    for (let i = 1; i <= displayLimit; ++i) {
        nums.push({value: i, formula: formulaMap[i]})
    }
    return nums
}