
function createStateMachine (initialState) {

  var currentState = null

  function handle (reducer) {

    var nextState = reducer(currentState)
    if (nextState !== currentState) {
      if (currentState && currentState.exit) {
        currentState.exit()
      }
      currentState = nextState
      if (currentState && currentState.entry) {
        currentState.entry()
      }
    }
  }

  handle(function () {
    return initialState
  })

  initialState = null

  return {
    handle: handle,
    invoke: function (eventName) {
      var args = [].slice.call(arguments, 1)
      return this.handle(function (state) {
        return state[eventName] ? state[eventName].apply(state, args) : state
      })
    }
  }
}

module.exports = createStateMachine

