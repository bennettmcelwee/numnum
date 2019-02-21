import React from 'react';

export default class Controls extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this)
  }

  onChange(event) {
    const setValue = this.props.setValue
    const target = event.target
    const value =
      target.type === "checkbox" ? target.checked
      : target.type === "number" ? Number(target.value)
      : target.value
    const name = target.name
    setValue(name, value)
  }

  render() {
    const settings = this.props.settings || {}
    return (
      <div className="controls">
          <h2>Settings</h2>
          <div className="group">Digit: <input name="digit" type="number" value={settings.digit} onChange={this.onChange}/></div>
          <div className="group">Count: <input name="countLimit" type="number" value={settings.countLimit} onChange={this.onChange}/></div>
          <div className="group">Seconds: <input name="maxDurationSeconds" type="number" value={settings.maxDurationSeconds} onChange={this.onChange}/></div>
          <div className="symbols group btn-group-toggle" data-toggle="buttons">
            {settings.allSymbols && settings.allSymbols.map(sym => {
                const isChecked = settings.symbols && settings.symbols.includes(sym)
                return (<label key={sym} className={'btn btn-outline-info' + (isChecked ? ' active' : '')}>
                    <input name={'symbol' + sym} type="checkbox" checked={isChecked} onChange={this.onChange}/> {sym}
                  </label>)
              })
            }
          </div>
          <div className="group btn-group-toggle" data-toggle="buttons">
            <label className={'btn btn-outline-info' + (settings.allowConcatenation ? ' active' : '')}>
              <input name="allowConcatenation" type="checkbox" checked={Boolean(settings.allowConcatenation)} onChange={this.onChange}/>
              Allow concatenation
            </label>
          </div>
          <div className="group">
            <button onClick={this.props.start} className="btn btn-success">Start</button>
            <button onClick={this.props.pause} className="btn btn-outline-primary">Pause</button>
            <button onClick={this.props.resume} className="btn btn-outline-primary">Resume</button>
          </div>
      </div>
    )
  }
}

