import React, { Component } from 'react'
import append from 'ramda/src/append'
import difference from 'ramda/src/difference'
import union from 'ramda/src/union'
import without from 'ramda/src/without'
import Controls from './Controls'
import Messager from './Messager'
import Status from './Status'

export default class App extends Component {

  constructor(props) {
    super(props)
    this.setValue = this.setValue.bind(this)
    this.start = this.start.bind(this)
    this.pause = this.pause.bind(this)
    this.resume = this.resume.bind(this)
    this.state = {
      messages: [],
      settings: {
        digit: 6,
        countMax: 5,
        symbols: ['+', '-', '×', '÷', '()', '.', '^', '!', '√'],
        maxDurationSeconds: 5,
      },
      snapshot: {
        answers: []
      }
    }
    this.worker = this.createWorker()
  }

  setValue(name, value) {
    const opMatch = name.match(/^symbol(.+)$/)
    if (opMatch) {
      const sym = opMatch[1]
      this.setState(state => ({settings: {
          ...state.settings,
          symbols: (value ? union : without)([sym], state.settings.symbols)
        }}))
    }
    else {
      this.setState(state => ({settings: {...state.settings, [name]: value}}))
    }
  }

  componentDidMount() {
    this.init()
  }

  init() {
    this.worker.postMessage({init: {
      options: {
        ...this.state.settings
      }
    }})
  }

  start() {
    this.worker.postMessage({start: {
      options: {
        ...this.state.settings
      }
    }})
  }

  pause() {
    this.worker.postMessage({pause: true})
  }

  resume() {
    this.worker.postMessage({resume: true})
  }

  createWorker() {
    const worker = new Worker('worker.js')
    worker.onmessage = e => {
      if (e.data.settings) {
        this.setState(state => ({
          settings: e.data.settings
        }))
      }
      if (e.data.message) {
        this.setState(state => ({
          messages: append(e.data.message, state.messages)
        }))
        console.log('Message: ', e.data.message)
      }
      if (e.data.snapshot) {
        // Update messages
        if (e.data.snapshot.answers && e.data.snapshot.answers.length) {
          this.setState(state => {
            const newAnswers = difference(e.data.snapshot.answers || [], state.snapshot.answers || [])
            const newMessages = state.messages || []
            if (newAnswers.length) {
              newMessages.push("New:" + newAnswers)
            }
            return newAnswers.length ? {
                messages: newMessages
              } : {}
          })
        }
        // Update snapshot
        this.setState(state => ({
          snapshot: e.data.snapshot
        }))
      }
    }
    return worker
  }

  render() {
    return (
      <div>
        <Controls
          settings={this.state.settings}
          setValue={this.setValue}
          start={this.start}
          pause={this.pause}
          resume={this.resume}
        />
        <Status state={this.state} />
        <Messager messages={this.state.messages} />
      </div>
    )
  }
}
