var Emitter = require('events').EventEmitter;
var util = require('util');
var sync = require('synchronize');

var nativeSlice = Array.prototype.slice;

/**
 * Represents a pending task.
 *
 * @param {Function} fn The function to run in the fiber.
 * @param {Array} args The arguments to call the function `fn` with.
 * @param {Function} resume The function to call when the task actually starts.
 */
function Task(fn, args, resume) {
  this.fn = fn;
  this.args = args;
  this.resume = resume;
}

/**
 * Doesn't pool fibers or anything like that, just limits the number of
 * concurrent fibers started by calling #start().
 *
 * You should _only_ #join() after you've have no more fibers to start.
 *
 * @param {Number} concurrentFactor The maximum number of fibers to let run
 *   concurrently.
 */
function SyncPool(concurrentFactor) {
  this._numActive = 0;
  this._numConcurrent = asPositiveInteger(concurrentFactor, 4, 1);

  this._waitingDone = false;
  this._isDone = false;

  this._errors = [];

  // Task queue.
  this._pending = [];
}

util.inherits(SyncPool, Emitter);

Object.assign(SyncPool.prototype, {
  /**
   * Attempts to start the function as in its own fiber. If there are already
   * `concurrentFactor` fibers running, this function will yield until the
   * function has been started.
   *
   * @param {Function} fn The function to run.
   * @param {...*} var_args The arguments to call the function with.
   */
  start: function(fn) {
    if (this._isDone) {
      throw new Error('cannot start fiber, this pool is done');
    }

    if (typeof fn !== 'function') {
      throw new TypeError('expected a function');
    }

    if (!sync.Fiber.current) {
      throw new Error('the start method must be called in a fiber');
    }

    var args = nativeSlice.call(arguments, 1);
    if (this._numActive < this._numConcurrent) {
      ++this._numActive;
      this._start(fn, args);
    } else {
      this._pending.push(new Task(fn, args, sync.defer()));
      sync.await();
    }
  },

  /**
   * Yields until all started or queued tasks complete, then returns an array of
   * errors encountered during processing, or an empty array if no errors were
   * encountered.
   */
  join: function() {
    if (!this._numActive) this._isDone = true;
    if (!this._isDone) {
      this._waitingDone = true;
      var done = sync.defer();
      this.once('done', function() {
        done(null);
      });
      sync.await();
    }
    return this._errors;
  },

  /**
   * @private
   */
  _start: function(fn, args) {
    var done = this._onFiberJoin.bind(this);
    setImmediate(function() {
      sync.fiber(function() {
        // We ignore the return value because we don't have anything to do with
        // it but if we wanted to support aggregating the return values we could
        // do that here.
        fn.apply(undefined, args);
      }, done);
    });
  },

  /**
   * @private
   */
  _onFiberJoin: function(err) {
    if (err) this._errors.push(err);

    if (this._pending.length) {
      var task = this._pending.shift(), resume = task.resume;

      // We do this to ensure the fiber that called start resumes before the
      // created fiber starts.
      try {
        resume(null);
      } finally {
        this._start(task.fn, task.args);
      }
    } else if (!--this._numActive && this._waitingDone) {
      this._isDone = true;
      this.emit('done');
    }
  }
});

/**
 * Coerce the input to a positive integer.
 *
 * @param {*} value
 * @param {Number} defaultValue
 * @param {Number} minValue
 * @return {Number}
 */
function asPositiveInteger(value, defaultValue, minValue) {
  if (typeof value !== 'number') {
    return defaultValue;
  }

  if (value <= 0) {
    return minValue;
  }

  value = value | 0;
  if (value <= 0) {
    return minValue;
  }

  if (value > 0) {
    return value;
  }

  // NaN
  return defaultValue;
}

module.exports = SyncPool;
