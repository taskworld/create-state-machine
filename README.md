# create-state-machine

An implementation of [__state pattern__](https://en.wikipedia.org/wiki/State_pattern) in JavaScript, designed to help removing state-dependent variables.

Please see the [motivation and example](#motivation-and-example) section on when and why you should use this pattern.


## Usage

```js
const { createStateMachine } = require('create-state-machine')
```


## API

### `createStateMachine(initialState)`

Creates a state machine with the given `initialState`.
It also calls `initialState.enter()` if exists.


### `stateMachine.getState()`

Returns the current state of the state machine.


### `stateMachine.setState(nextState)`

Changes the state of the state machine.

If will call the `exit()` method on the previous state if defined, and then call the `enter()` method of the next state, if defined.



## Motivation and Example

State pattern is very useful when your system has to exist in different states.
Without the state pattern, your variables may be used by some states, but are irrelevant in other states.

For example, consider a message buffer that queues up a messages.

- When a subscriber connects to it, the buffer should flush all messages to that subscriber.
- Once connected, new messages should also go directly to the subscriber, bypassing the queue.
- If the subscriber disconnects, then it should go back to queueing mode.
- Only a single subscriber is allowed.

### Normal version

Here’s how it’s likely to be implemented without using state pattern.

```js
// example/createMessageBuffer.normal.js
export function createMessageBuffer (onMove) {
  let _connected = false
  let _subscriber = null
  let _queue = [ ]

  return {
    push (message) {
      if (_connected) {
        _subscriber(message)
      } else {
        _queue.push(message)
      }
    },
    connect (subscriber) {
      if (_connected) throw new Error('Already connected!')
      _connected = true
      _subscriber = subscriber
      _queue.forEach((message) => subscriber(message))
      _queue = null
    },
    disconnect () {
      if (!_connected) throw new Error('Not connected!')
      _connected = false
      _subscriber = null
      _queue = [ ]
    },
    isConnected () {
      return _connected
    }
  }
}

export default createMessageBuffer
```

__In this version, there are many state-dependent variables.__

- The `_queue` is only used in disconnected state.
- The `_subscriber` is only used in connected state.

But these variables exist under the same scope, although they are used in some states but not the others.

__This is a code smell.__ You have to keep track of the current state and which variables are related to that state when you read/modify the code. Also, if not careful, your system may get into an inconsistent state (e.g. `_connected` is false but `_queue` is null).


### Solving this problem with a state machine.

Now, let’s see what happens if you use a __state machine__.

```js
// example/createMessageBuffer.state.js
import createStateMachine from '../'
export function createMessageBuffer (onMove) {
  const { getState, setState } = createStateMachine(disconnectedState())

  function disconnectedState () {
    const queue = [ ]
    return {
      connected: false,
      push (message) {
        queue.push(message)
      },
      connect (subscriber) {
        queue.forEach((message) => subscriber(message))
        setState(connectedState(subscriber))
      },
      disconnect () {
        throw new Error('Not connected!')
      }
    }
  }

  function connectedState (subscriber) {
    return {
      connected: true,
      push (message) {
        subscriber(message)
      },
      connect () {
        throw new Error('Already connected!')
      },
      disconnect () {
        setState(disconnectedState())
      }
    }
  }

  return {
    push (message) {
      return getState().push(message)
    },
    connect (subscriber) {
      return getState().connect(subscriber)
    },
    disconnect () {
      return getState().disconnect()
    },
    isConnected () {
      return getState().connected
    }
  }
}

export default createMessageBuffer
```

__In this version, each state has its own closure.__

- The disconnected state only has access to the `queue`.
- The connected state only has access to the `subscriber`.
- There is no need to reassign any variable. We [only use `const`](https://medium.com/javascript-scene/javascript-es6-var-let-or-const-ba58b8dcde75#.im9d6jfpi); no need for `var` or `let`.
- There are no more conditionals.

This makes your code cleaner and easier to reason about.


### The test

```js
// example/messageBufferTest.js
export default (createMessageBuffer) => {
  describe('a message buffer', () => {
    it('should flush messages to subscriber', () => {
      const buffer = createMessageBuffer()
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)

      const subscriber = createSubscriber()
      assert.deepEqual(subscriber.getMessages(), [ ])
      buffer.connect(subscriber)
      assert.deepEqual(subscriber.getMessages(), [ 1, 2, 3 ])
      buffer.push(4)
      assert.deepEqual(subscriber.getMessages(), [ 1, 2, 3, 4 ])
    })

    it('should queue messages to the next subscriber when one disconnects', () => {
      const buffer = createMessageBuffer()
      buffer.push(1)
      buffer.connect(createSubscriber())
      buffer.push(2)
      buffer.disconnect()
      buffer.push(3)

      const subscriber = createSubscriber()
      buffer.connect(subscriber)
      assert.deepEqual(subscriber.getMessages(), [ 3 ])
      buffer.push(4)
      assert.deepEqual(subscriber.getMessages(), [ 3, 4 ])
    })

    it('should not allow multiple subscribers', () => {
      const buffer = createMessageBuffer()
      buffer.connect(createSubscriber())
      assert.throws(() => {
        buffer.connect(createSubscriber())
      })
    })

    it('should allow querying its status', () => {
      const buffer = createMessageBuffer()
      assert(!buffer.isConnected())
      buffer.connect(createSubscriber())
      assert(buffer.isConnected())
      buffer.disconnect()
      assert(!buffer.isConnected())
    })

    it('fails when disconnecting a disconnected buffer', () => {
      assert.throws(() => {
        createMessageBuffer().disconnect()
      })
    })
  })

  function createSubscriber () {
    const messages = [ ]
    function subscriber (message) {
      messages.push(message)
    }
    subscriber.getMessages = () => messages
    return subscriber
  }
}
```

```js
// example/createMessageBuffer.normal.test.js
import messageBufferTest from './messageBufferTest'
import createMessageBuffer from './createMessageBuffer.normal'
messageBufferTest(createMessageBuffer)
```

```js
// example/createMessageBuffer.state.test.js
import messageBufferTest from './messageBufferTest'
import createMessageBuffer from './createMessageBuffer.state'
messageBufferTest(createMessageBuffer)
```


## The implementation

Here’s the entire implementation of `createStateMachine`.
You see, it’s pretty simple!

```js
// index.js
export function createStateMachine (initialState) {
  let _state
  function getState () {
    return _state
  }
  function setState (nextState) {
    if (nextState !== _state) {
      if (_state && _state.exit) _state.exit()
      _state = nextState
      if (_state.enter) _state.enter()
    }
  }
  setState(initialState)
  return { getState, setState }
}

export default createStateMachine
```
