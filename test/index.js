var sync = require('synchronize');
var expect = require('chai').expect;

var SyncPool = require('..');

describe('synchronize-pool', function() {
  it('should fail without a fiber context', function() {
    var pool = new SyncPool(100);
    expect(function() {
      pool.start(function() {});
    }).to.throw('fiber');
  });

  it('should limit concurrent execution to 1', function(done) {
    sync.fiber(function() {
      var ops = [];

      var pool = new SyncPool(1);

      pool.start(function() {
        ops.push(1);
        sync.await(setImmediate(sync.defer()));
        ops.push(2);
      });

      ops.push(0);

      pool.start(function() {
        ops.push(4);
        sync.await(setImmediate(sync.defer()));
        ops.push(5);
      });

      ops.push(3);

      expect(pool.join()).to.deep.equal([]);

      ops.push(6);

      expect(ops).to.deep.equal([0, 1, 2, 3, 4, 5, 6]);
    }, done);
  });

  it('should limit concurrent execution to 3', function(done) {
    sync.fiber(function() {
      var startOrder = [], endOrder = [];

      var actions = {};

      function pause(n) {
        expect(actions).to.not.have.ownProperty(n);
        actions[n] = sync.defer();
        sync.await();
      }

      function resume(n) {
        expect(actions).to.have.ownProperty(n);
        expect(actions[n]).to.be.a('function');
        var fn = actions[n];
        delete actions[n];
        fn();
      }

      var pool = new SyncPool(3);

      pool.start(function() {
        startOrder.push(0);
        pause(0);
        endOrder.push(0);
      });

      pool.start(function() {
        startOrder.push(1);
        pause(1);
        endOrder.push(1);
      });

      pool.start(function() {
        startOrder.push(2);
        pause(2);
        endOrder.push(2);
      });

      setImmediate(function() {
        // After we've yielded pending the next pool#start:
        resume(1);
        resume(2);
        resume(0);
      });

      pool.start(function() {
        startOrder.push(3);
        pause(3);
        endOrder.push(3);
      });

      pool.start(function() {
        startOrder.push(4);
        pause(4);
        endOrder.push(4);
      });

      setImmediate(function() {
        resume(4);
        resume(3);
      });

      expect(pool.join()).to.deep.equal([]);

      endOrder.push(5);

      expect(startOrder).to.deep.equal([0, 1, 2, 3, 4]);
      expect(endOrder).to.deep.equal([1, 2, 0, 4, 3, 5]);
    }, done);
  });

  it('should work with a cursor', function(done) {
    sync.fiber(function() {
      var array = [1, 2, 3, 4, 5, 6, 7, 8, 9],
        cursor = new Cursor(array),
        hits = 0;

      var pool = new SyncPool(4);

      for (var value; (value = sync.await(cursor.next(sync.defer()))); ) {
        pool.start(function(value) {
          expect(value).to.equal(array[hits++]);

          var wait = (Math.random() * 10) | 0;
          sync.await(setTimeout(sync.defer(), wait));
        }, value);
      }

      expect(pool.join()).to.deep.equal([]);

      expect(hits).to.equal(9);
    }, done);
  });
});

function Cursor(array) {
  this._array = array;
  this._index = 0;
}

Cursor.prototype.next = function(callback) {
  var done = this._array.length === this._index,
    result = done ? null : this._array[this._index++];

  setImmediate(function() {
    callback(null, result);
  });
};
