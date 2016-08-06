synchronize-pool
================

Concurrent control of fibers on a per-pool basis with [synchronize.js](http://alexeypetrushin.github.io/synchronize/docs/index.html).

[![Build Status](https://travis-ci.org/mixmaxhq/synchronize-pool.svg?branch=master)](https://travis-ci.org/mixmaxhq/synchronize-pool)

Construct a pool object, and create fibers attached to the pool, with a
configurable cap on the number of active fibers running on the pool.

```js
var sync = require('synchronize');
var SyncPool = require('synchronize-pool');

// We can only run sendResult 10 at any one point in time.
var pool = new SyncPool(10);

sync.fiber(function() {
  // Load everything!
  for (var i = 0; i < 1000000; i++) {
    // We could move this into the pool#start fiber if the getResult API isn't
    // stateful.
    var result = sync.await(getResult(i, sync.defer()));

    // Pass the variable through like this to avoid binding to the iterating
    // variable; not a problem if using Array#forEach or a similar iterator
    // mechanism.
    pool.start(function(result) {
      sync.await(sendResult(result, sync.defer()));

      // The pool will notice when this fiber finishes, and start the next - or
      // resume from the join call below.
    }, result);
  }

  // Wait for all the fibers in the pool to finish.
  pool.join();

  // We only log this once every result has been processed.
  console.log('done');
});
```

If this strikes you as similar to
[batch](https://github.com/visionmedia/batch/), that's because it is. It
differs, however, in that it has built-in backpressure, to simplify writing
concurrent code that avoids loading everything into memory.

Install
-------

```sh
$ npm install synchronize-pool
```

API
---

### new SyncPool(concurrentFactor)

This is a constructor, and must be called with `new`.

The `concurrentFactor` parameter controls the number of fibers that may run
concurrently.

```js
var pool = new SyncPool(4);
```

Note that this pool does not reuse fiber instances.

### SyncPool#start(fn, args...)

Attempts to start the function as in its own fiber. If there are already
`concurrentFactor` fibers running, this function will yield until the function
can be started.

```js
pool.start(function(hello, world) {
  console.log(hello, world);
}, 'Hello,', 'world!');
```

### SyncPool#join()

Yield until all the started or queued fibers have finished. Unless you know what
you're doing, **do not call join() if you intend to call start() again**.

```js
pool.start(function() {
  sync.await(setTimeout(sync.defer(), 1000)(;
});

pool.join();

// runs after 1 second
console.log('after join');
```

Returns the errors produced by the fibers, if any:

```js
pool.start(function() {
  throw new Error('nope');
});

var errors = pool.join();

// prints "[ [Error: nope] ]"
console.log(errors);
```

FAQ
---

### Why "sychronize-pool?"

If you have a better name, feel free to open a [pull
request](https://github.com/mixmaxhq/synchronize-pool/pulls). It's true that
this name isn't super accurate.

### Ew.

`¯\_(ツ)_/¯`

License
-------

> The MIT License (MIT)
>
> Copyright &copy; 2016 Mixmax, Inc ([mixmax.com](https://mixmax.com))
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in allcopies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
