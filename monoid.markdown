Let's start with monoids. Monoids are awesome because they are extremely general, yet they're
also very simple and there's an easy intuition to guid your understanding. And even though the
interface and properties a monoid gives you are very simple, there are some very useful things
you can do with them as monoids.

In short, if a data type is a monoid, you can put two things of that type together and always
get a new instance of that type.

With a few restrictions. One is that the order of the items you combine can matter, but nesting
can't. The other is that there has to be an identity element of that type for that operation, so
that combining anything with the identity element returns the thing.

##Getting more formally acquainted.

Formally<sup>[\[1\]](#formal)</sup><a name="1"></a>, a data type `t` with a binary operation `*`
is a moniod iff:

1. For any two instances `a` and `b` of type `t`, `a * b` is of type `t`. This is the rule of
**closure**.
2. There is an instance `i` of type `t` such that for any `a` of type `t`, `i*a = a*i = a`. This
is the rule of **identity**.
3. For any `a`, `b`, and `c` of type `t`, `(a*b)*c = a*(b*c)`. This is the rule of
**associativity**.

I will refer to the associativity and identity rules as the **monoid laws**.

Lots of things are monoids. For real numbers, addition and multiplication are monoids. Boolean and
and or are both monoids. String and Array concatenation are both moniods. Set union is a monoid.
I'll come back to these and more later, but first, I need to lay down some code foundations.

### Doing it in Javascript

Monoids provide an interface for data types to implement with a single binary operator and
a distinguished identity instance. Javascript doesn't really have explicit interfaces or a
rich set of data types. So I'm going to model data types the traditional way they're modeled
in Javascript, with constructor functions and prototypes. And I'm going to make Monoid a
function that takes a constructor function, and installs a specific interface on that function
and it's prototype. Here it is<sup>[\[2\]](#monoid-core)</sup><a name="2"></a>:

    function Monoid(type, props) {
      var proto = type.prototype;

      proto.id  = props.id;
      proto.dot = props.dot;
      proto._   = proto.dot; //_ alias because js doesn't allow user defined operators

      type.dot = function(a, b) { return a._(b); }
      type.id  = proto.id;

      //optional properties. Used for quick checking laws
      proto.eq  = props.eq;
      type.eq  = function(a, b) { return a.eq(b) };
      type.arb = props.arb;

      type.laws = {
        left_identity:  function left_identity(a) { return type.id._(a).eq(a); },
        right_identity: function right_identity(a){ return a._(type.id).eq(a); },
        associativity:  function associativity(a, b, c){ return a._(b._(c)).eq( (a._(b))._(c) ); }
      };

      Monoid.known.push(type);
      Monoid.byName[type.name] = type;
    }

We take a constructor and an object "`props`" the definitions for the monoid's interface.
`props` must minimally have a `dot` and `id` property, which get added to the `type`'s
prototype, with static versions added to the type itself.

There are two optional properties, `eq` and `arb`. `eq` tests instances for equality, and
`arb` generates an arbitrary instance of the monoid. Then it installs the monoid laws as
static boolean functions on the `type`. I'll have more to say on these properties and their
uses in the section on testing.

For convenient introspection, I have the `Monoid` function itself track all the types that
have been declared monoids, with an array `known`, and a hash of string names to the type
constructor functions, `byName`. We need to initalize these.

    Monoid.known = []; //known monoid types.
    Monoid.byName = {};//known types by name

And now we can start declare some monoids.

## Monoid instances<sup>[\[3\]](#monoid-instances)</sup><a name="3"></a>:

Numbers are monoids. You can add them.

    function Sum (val) { this.val = val; }
    Monoid(Sum, {
      id: new Sum(0),
      dot: function(other) { return new Sum(this.val + other.val) },
    });

Numbers are also monoids. You can multiply them.

    function Product (val) { this.val = val; }
    Monoid(Product, {
      id: new Product(1),
      dot: function(other) { return new Product(this.val * other.val) },
    });

Numbers can be monoids too, if you take the smaller number each time you put two together.

    function Min (val) { this.val = val; }
    Monoid(Min, {
      id: new Min(Number.POSITIVE_INFINITY),
      dot: function(other) { return new Min(Math.min(this.val, other.val)) },
    });

If you weren't sure if Numbers were monoids, it turns out they are.

    function Max (val) { this.val = val; }
    Monoid(Max, {
      id: new Max(-Number.POSITIVE_INFINITY),
      dot: function(other) { return new Max(Math.max(this.val, other.val)) },
    });

I want to pause here to reflect on how coding with this monoid API would look. If we want
to combine a bunch of numbers in an abstract way, allowing me to swap out monoids, I would
have to pass around a `monoid` variable, and wrap every primitive value in a `new monoid(val)`.
Not pleasant.

There are a few approaches to solving this. The [proof-of-concept code][project] for this article
uses a few strategies. It has a coercion protocol for combining a wrapped value with a primitive
transparently. It has a `dotPrimitive` property to combine primitive values using the monoid's
dot operator (so `Sum.dotPrimitive(3, 4) == 7`).

An alternative approach is to build monoids around the binary operator itself. With this sort
of API, `Monoid` would be a constructor that takes a binary operator and an identity, and
constructs a new monoid. Something like `Sum` might be:

  sum = new Monoid(function(a, b) {return a + b}, {id: 0});
  sum.id;     //=> 0
  sum(5, 12); //=> 17

I may refactor my monoid code to use the operator-oriented representation in the future. For now,
let's continue with this data-oriented representation.

Boolean also belong to (at least) two monoids:

    function Any (val) { this.val = val; }
    Monoid(Any, {
      id: new Any(false),
      dot: function(other) { return new Any(this.val || other.val) },
    });

    function All (val) { this.val = val; }
    Monoid(All, {
      id: new All(true),
      dot: function(other) { return new All(this.val && other.val) },
    });

Concatenating Strings and Arrays is a monoidal operation:

    Monoid(String, {
      id: '',
      dot: function(other) { return this + other }
    });

    Monoid(Array, {
      id: [],
      dot: Array.prototype.concat
    });

The set union operator forms a monoid for sets, with the identity being the empty set. Intersection
can also be a monoid, with the Universe (the set of all the items under consideration) as the identity.
What sorts of sets do we have in JavaScript, and how can we define monoids around them?

The most obvious sets are object properties. We can define a union monoid quite easily.

    function ObjectUnion(object) {
      var self = this;
      Object.keys(object).forEach(function(key) {
        self[key] = object[key];
      });
    }
    Monoid(ObjectUnion, {
      id: new ObjectUnion({}),
      dot: function(other){
        var result = new ObjectUnion({});
        var self = this;
        Object.keys(self).forEach(function(k) { result[k] = self[k]; });
        Object.keys(other).forEach(function(k) { result[k] = other[k]; });
      }
    );

The dot operator is a naive property union, where the value for a property shared by both objects
is resolved by letting the right property win. We'll see a better object union when I talk about
using monoids for logging.

But there are more ways to represent a set than enumerating the members. Any function that returns
a boolean value can be treated as a set, the set of things that function is true of. I'll call
such a function a **predicate**. We can check membership in a set represented by a predicate `p`
with the function `isMember`, `function isMember(x,p) { return p(x) }`.

We can build set union and intersection monoids around these predicates:

    function PredicateUnion() {
      this.ps = Array.prototype.slice.call(arguments);
    }
    var proto = PredicateUnion.prototype;
    proto.contains = function(x) { return this.ps.map(function(p){return p(x);}).some(id); };
    proto.union = function(p){
      var ps = this.ps;
      p.ps.forEach(function(pred) { ps.push(pred) });
      return this;
    };
    Monoid(PredicateUnion, {
      id: new PredicateUnion(function(x){ return false }),
      dot: function(other) {
        p = new PredicateUnion();

        return p.union(this).union(other);
      };
    });

    function PredicateIntersection() {
      this.ps = Array.prototype.slice.call(arguments);
    }
    proto = PredicateIntersection.prototype;
    proto.contains = function(x) { return this.ps.map(function(p){return p(x);}).every(id); };
    proto.intersect = function(p){
      if(p instanceof PredicateIntersection) {
        var ps = this.ps;
        p.ps.forEach(function(pred) { ps.push(pred) });
      }
      else { this.ps.push(p); }
      return this;
    };
    Monoid(PredicateIntersection, {
      id: new PredicateIntersection(),
      dot: function(other) {
        p = new PredicateIntersection();
        return p.intersect(this).intersect(other);
      }
    });

In this example code, `id` is the identity function, `function id(x) {return x}`.

Let's go back to our intuitions about what a monoid is: it's a way to combine objects, where
the right-to-left ordering of the objects might matter but the nesting does it. And a special
identity object that does nothing to whatever you combine it with. When you think of it this
way, we can come up with all sorts of ways to to put things together. We can put strings
together while inserting a string between them, if we be allow `null` and are careful to do
nothing with `null`.

    function Line(line) { this.val = line }
    Monoid(Line, {
      id: new Line(null),
      dot: function(other) {
        if(other.val == null) return this;
        if(this.val == null) return other;
        return new Line(this.val + "\n" + other.val);
      }
    });

Now we can combine strings in a nice line oriented manner if we want.

We could just always have the first or last thing win, unless it's `undefined`.

    function First(val) { this.val = val; }
    Monoid(First, {
      id: new First(undefined),
      dot: function(other) { if(this.val === undefined){return other} return this; }
    });

    function Last(val) { this.val = val; }
    Monoid(Last, {
      id: new Last(undefined),
      dot: function(other) { if(other.val === undefined){return this} return other; }
    });

And if you want something supendously useless:

    function MaximallyUseless(){}
    Monoid(MaximallyUseless, {
      id: new MaximallyUseless(),
      dot: function() { return MaximallyUseless.id; }
    });

## Generic monoid algorithms.

One thing you can do with any monoid is take a collection of instances and reduce them
down to a single value by repeated application of the dot:

    function aggregate(array, monoid) {
      return array.reduce(monoid.dot, monoid.id);
    }

Here I show it for an array, but we can do this for any container type that has an order.
So given a tree and a traversal algorithm (say breadth first or depth first preorder), if the
the nodes contain elements of a monoid, we can reduce them down to a single value (which you
may hear called the _monoidal summary_ of that tree).

So you can reduce with a monoid operator. That may not be a big deal. But associativity buys us
something.

### Parallelism

Because the monoidal operation is associative, we can reduce sub parts of the array to their
monoidal summary in separate threads. We then gather the results from each thread, reduce this
smaller collection, and return the result.

You can find some proof of concept code in the [parallel][parallel] and [worker][worker] parts
of the monoid code. This project also contains the following test code:

    var time = process.hrtime();
    var answer = m.aggregatePrimitive(arrPrim, Sum);
    var diff = process.hrtime(time);
    console.log('aggregate took %d seconds and %d nanoseconds', diff[0], diff[1]);

    time = process.hrtime();
    agg_p(arrPrim, Sum, 6, function(result) {
      var diff = process.hrtime(time);
      console.log('aggregate_p took %d seconds and %d nanoseconds', diff[0], diff[1]);
      console.log('answer: ' + answer);
      console.log('got:    ' + result);
      process.exit(0);
    });

Here `aggregatePrimitive(array, monoid)` reduces an `array` of primitive values using
`monoid.dotPrimitive`, while `agg_p(array, monoid, num_workers, callback)` does the same thing in
chunks asynchronously across at most `num_workers` child processes, collects and reduces the results,
and passes it on as the argument to `callback`.

Unfortunately, a parent process can only communicate to a child process by passing messages, which
serializes the message data as a JSON value. So to parallelize the aggregation, I have to slice the
array to pieces (a memory allocation, and possibly a copy), serialize it into a message with some
extra bookkeeping info, get the message in the worker thread, deserialize the message, perform the
reduce, send another message back to the parent, and put the results together in the parent.

If that sounds like it can't possibly be faster than doing a simple summation in the parent, you
are right. `aggregatePrimitive` can sum an array of 20,000,000 numbers in about a second on my
computer. `agg_p` took 32 seconds on 3 cores. On the bright side, it took 16 seconds on 6 cores,
and produced correct results in all cases.

But the insight here is important: collections of a moniod are good things to reduce. The identity
laws mean we can break the task down without worrying about the base case of an empty container.
Having an identity means we have a value to use when our collection happens to be empty. The associative
laws mean we can chunk the task into smaller pieces and recombine those pieces, because grouping doesn't
matter. The "Reduce" part of "MapReduce" implicitly uses monoids.

To get an actual performance boost out of `agg_p` we'd need a native plugin that could pass a reference,
offset, and length for the array to the worker threads to save us the memory allocation and serialization
that bogs my implementation. Or a library like Intel's [RiverTrail][rivertrail] to take care of the hard
parts for us.

So parallel reduction implicitly must be using monoids. Why be explicit about it? Testing.

##Testing those laws

We have two constraints that apply to all monoids. These are excellent properties to check. If you aren't
familiar with property based testing, check out [my primer][qc-primer].

I decided to split the identity law into two properties, left and right identity. Recall that the following
properties are added to every monoid you declare:

      type.laws = {
        left_identity:  function left_identity(a) { return type.id._(a).eq(a); },
        right_identity: function right_identity(a){ return a._(type.id).eq(a); },
        associativity:  function associativity(a, b, c){ return a._(b._(c)).eq( (a._(b))._(c) ); }
      };

We can write a simple law checking function that teste that these laws hold:

    function check_laws(m) {
      console.log("Testing " + m.name + "'s monoid laws:");
      qc.forAll(m.laws.left_identity,  m.arb);
      qc.forAll(m.laws.right_identity, m.arb);
      qc.forAll(m.laws.associativity,  m.arb, m.arb, m.arb);
      console.log()
    }

This function requires that the monoid define `arb` to generate arbitrary data, and `eq` to check
instances for equality. I'm not going to show `arb` and `eq` for most of the monoids we've seen
so far. `arb` for the numeric, boolean, and string monoids are all just taken from the quickcheck
library. `eq` for most of these is obvious. For numbers, `eq` is tricky, but I talk about that quite
a bit in the [property based testing primer][qc-primer] so you can reference that or the project
source code [on github][project] for the details.

Since we kept track of all the known monoids as we registered them, we can test all the ones fit for
testing.

    function test_all_monoids() {
      var results = m.aggregate(
        m.Monoid.known
          .filter(function(m) {return m.eq && m.arb;})
          .map(check_laws)
      );
    }

It's that simple.

Most of the monoids I've shown you are pretty simple. But square matrices of the same size form a
monoid under matrix multiplication, with the identity matrix as the identity element. Testing the
identity and associativity laws for matrix multiplication migth substantially increase our confidence
in our implementation of matrix multiplication, especially since highly optimized algorithms for matrix
multiplication are not trivial.

But if you're like me, you're looking at this code and thinking it could be better. It could collect
the results of those tests, instead of just printing them, and pass them back to the caller, so they could
be collected with the results of other tests.

It sounds like we'd want a test log object that summarizes our test run. Here's a few things that I'd like
to do with a test log.

1. Combine two logs into a new log with a summary of both sets of tests.
2. We may or may not want the combined summary to preserve the order of the sub-tests. We probably
don't need to track sub-test nesting.
3. Combining the log from a sub-test with no tests with another test log shouldn't change that other test
log in any way.

This test log should be a monoid!

##Logging with Monoids

Here are a few other design requirements for a logging/summary system:

1. Logs should combine easily. When two logs have summaries of the same thing, they should combine
summaries. When they summarize different things, the new log should contain all the different summaries
present in both sub-logs.
2. Code that logs information should not have to know about any other information logged by other code.
3. Code should not need to be passed a log to properly log its information. It should be able to create
its own log to hand off to the code that handles log aggregation.

Logs will simply be objects. Each property of the object is a sub-log, whose value must be in a monoid.
When two logs are combined with the `dot` method, their properties are unioned. The value for each property
in the new log is the monoidal `dot` combination of the values of the two original logs. If one of the
original logs has a property that the other doesn't, then the resulting log's value is the value from the
log containing that property.

    function add_log_key(logs, key, value) {
      if( value instanceof Function )
      { //assume we got a constructor
        logs[key] = value.id;
      }
      else
      { //got a starting value
        logs[key] = value;
      }
    }

    function Log(logs) {
      var self = this;
      Object.keys(logs).forEach(function(key){
        add_log_key(self, key, logs[key]);
      });
    }
    proto = Log.prototype;
    proto.addLog = function(key, inital) {
      if(this === Log.id){ throw "Tried to mutate Log.id" };
      add_log_key(this, key, inital);
      return this;
    }
    proto.log = function(values) {
      if(this === Log.id){ throw "Tried to mutate Log.id" };
      var self = this;
      Object.keys(values).forEach(function(key){
        self[key] = self[key]._(values[key]);
      });
      return this;
    };

This defines a (non-monoidal) public interface for `Log`. You add a new log to your `Log` by invoking
the `addLog` method with the property name you want and a monoidal constructor (which defaults to that
monoid's `id`) or initial monoidal value. You log new data for a log property with the `log` method,
passing in a plain-old js object whose keys are the log properties you want to add. The values of your
the logs get updated by monoidal concatenation with the values in your object argument. As the guard
conditions indicate, both these methods mutate your log object in place. Don't try to do it with `Log.id`.
Then `Log.id` would no longer be an identity for `Log.dot`, and all hell would break loose.

Note also that `Object.keys(obj)` returns string array of `obj`'s own keys. These functions will work even
if you extend `Object.prototype` without marking your new properties not enumerable.

This will be the most complex monoid in this post<sup>[\[4\]](#hask-tuple)</sup><a name="4"></a>, so we
definitely want an `arb` method and an `eq` method to test those monoid laws just in case I've done
something boneheaded with my `dot` method<sup>[\[4\]](#log-bug)</sup><a name="5"></a>.

    function arbObject() {
      random_prop = String.arb();

      obj = { a: Sum.arb(), b: All.arb(), stuff: Array.arb() };
      obj[random_prop] = String.arb();
      return obj;
    }
    function deepEq(other) {
      if(this === other) return true;
      var self = this;

      return Object.keys(this).every(function(key) {
        return other[key] != null && self[key].eq(other[key]);
      });
    }
    function logDot(other) {
      var self = this;
      var result = {};
      Object.keys(this).forEach(function(k) { result[k] = self[k]; });
      Object.keys(other).forEach(function(k) {
        if(result.hasOwnProperty(k)){
          result[k] = result[k].dot(other[k]);
        }
        else { result[k] = other[k]; }
      });
      return new Log(result);
    };
    Monoid(Log, {id: new Log({}), dot: logDot, arb: arbObject, eq: deepEq});

So let's see this in action. First we need to hack quickcheck's `forAll` function:

    var m = require('./monoid');
    function forAll(property) {
      var
        generators = Array.prototype.slice.call(arguments, 1),
        fn         = function (f) { return f(); },
        log        = new m.Log({
          total_failed: m.Sum,
          failed: m.Any,
        }),
        i,
        values;

      for (i = 0; i < 100; i ++) {
        values = generators.map(fn);

        if (!property.apply(null, values)) {
          console.log("*** Failed!\n" + values);
          log.info = new m.Log({property: [property.name], args: [values]});
          return log.log({total_failed: 1, failed: true})
        }
      }

      console.log("+++ OK, passed 100 tests.");
      return log;
    }

Start with the initialization. We create a `log` with two properties, `total_failed` which starts at 0
and sums all the failures, and `failed` which starts false and flips to true just in case any test fails.
If all the tests pass, this initial log is returned unchanged.

The interesting case is when a test fails. First, we add a new property to the log, `info`, which is itself
a log containing an `property` and `args`. `property` is an array with the name of the failing property,
and `args` is an array containing an array of the arguments that falsified the property. The nested log
allows us to namespace logs. The `property` and `args` values are wrapped in arrays so that when we combine
two logs summarizing failing tests, the properties and arguments that failed will be concatenated together,
while each failing property will be at the same index as its falsifying arguments.

Let's see the code combining combining logs. Here's a modified `check_laws`:

    function check_laws(m) {
      var log;
      console.log("Testing " + m.name + "'s monoid laws:");
      log = qc.forAll(m.laws.left_identity,  m.arb);
      log = log._( qc.forAll(m.laws.right_identity, m.arb) );
      log = log._( qc.forAll(m.laws.associativity,  m.arb, m.arb, m.arb) );
      if(log.failed.val){
        log.addLog('groups', [{name: m.name, info: log.info}]);
      };
      console.log()
      return log;
    }

Now we combine the information in the three tests with `Log`'s `dot` method (using it's `_` alias here).
Because I'd like to keep the information about failed tests for separate monoids separate, I define a
new `groups` log property that put's the failing monoids name and it's failure `info` together into an
array.

Now when we test all our monoids, all we have to do is combine the resulting logs and format the
information nicely for the console.

    function test_all_monoids() {
      var results = m.aggregate(
        m.Monoid.known
          .filter(function(m) {return m.eq && m.arb;})
          .map(check_laws)
      );

      if(results.failed.val) {
        console.log( results.total_failed.val + ' test(s) failed:');
        results['groups'].forEach(function(group){
          console.log('  '+group.name+' failed:');
          zipWith(
            function(prop, args){ return '    ' +prop + ': ' + args.join(','); },
            group.info.property, group.info.args
          ).forEach(function(msg) { console.log(msg)});
          console.log();
        })
      }
      else {
        console.log('All tests passed.');
      }
      return results;
    }

Now, if I tweak `Product` to divide numbers and `All.id` to `false`, I get the following message.

    4 test(s) failed:
      Product failed:
        left_identity: 709.1053305605122
        associativity: 709.7295254795905,708.1961540475892,709.2243852080616

      All failed:
        left_identity: true
        right_identity: true

That's much nicer.

I managed to collect and manipulate test result data with very little violence to my original code.
Individual tests can just generate their own result data. Test runners can aggregate those results
easily. In a larger example, very different parts of an application can generate logs with overlapping
and orthogonal data. The only logging knowledge that has to leak from one component of the application
to another is namespacing. The different pieces must put the information with the same meaning to under
the same namespace in the log, and information with distinct meanings under different names. That's some
pretty nice decoupling of data collecting concerns across an app.

##Conclusion

Monoids land in a nice sweet spot for programming. They're rich enough to be useful, but simple enough
to be _everywhere_. I think parallelizing reduce and logging summaries are some of the killer applications
of monoids in programming, but people have found many other uses as well.
[Cabal](http://www.haskell.org/cabal/) and [Xmonad](http://xmonad.org/) both use monoids
[to manage configuration][monoid-comment] and [combine configs][monoid-prefs] from files, defaults, and
command line options in a sensible way. [Finger trees][finger-tree] are another interesting application
of monoids. Their abstractness allows you to swap monoids easily, radically changing the behavior of the
data structure's basic operations.

##Further Reading

[Haskell Monoids](https://en.wikibooks.org/wiki/Haskell/Monoids) on Wikibooks  
[Haskell Monoids and their Uses](http://blog.sigfpe.com/2009/01/haskell-monoids-and-their-uses.html) over
at [A Neighborhood of Inifinity](http://blog.sigfpe.com/).  
[Fast incremental regular expression matching with monoids][regex], also from
[A Neighborhood of Inifinity](http://blog.sigfpe.com/).  

##Footnotes
<a name="formal">[1]</a> Typically, monoids are characterized in terms of a set, rather than
a data type. You can think of a type as a set containing all the possible instances of that
type. See [the Wikipedia page](https://en.wikipedia.org/wiki/Monoid#Definition) for the formal
definition. [(back)](#1)  
<a name="monoid-core">[2]</a> This is a simplified version of a more featureful implementation
in the [node-algebraic GitHub project][corejs]. If this project seems useful to you, please let
me know. It's currently just proof-of-conecpt code, and poorly tested, but that can change quickly
if there's interest.[(back)](#2)  
<a name="monoid-instances">[3]</a> More featureful implementations of most of these, and a few
other monoids, can be found in [the instances][instancesjs] part of the that GitHub project.
[(back)](#3)  
<a name="hask-tuple">[4]</a> The `Log` monoid is inspired by Haskell's various tuple instances
of `Monoid`. JavaScript's dynamic type system allows this to be much more flexible. To get something
similar in Haskell, you would have to declare a record type whose fields were the indivdual logs. The
benefit to the static type is that accidental name collision would be much less likely to occur. But
that one data type would have to know all the types of information logged in the various parts of the
system, and it would have to change any time a new type of information was collected.[(back)](#4)  
<a name="log-bugs">[5]</a> Of course, I did. I forgot to declare `result` with `var`, so nested logs
crashed and burned horribly. Unfortunately my `arb` function doesn't generate nested logs, so my tests
all pass the quickcheck. It's important to generate test data of at least the complexity found in the
data in your app if you want quickcheck to _really_ give you confidence in your code. [(back)](#5)  

[corejs]: https://github.com/adambaker/node-algebraic/blob/master/monoid/core.js
[instancesjs]: https://github.com/adambaker/node-algebraic/blob/master/monoid/instances.js
[project]: https://github.com/adambaker/node-algebraic/tree/master/monoid
[parallel]: https://github.com/adambaker/node-algebraic/blob/master/monoid/parallel.js
[worker]: https://github.com/adambaker/node-algebraic/blob/master/monoid/worker.js
[rivertrail]: https://github.com/RiverTrail/RiverTrail
[qc-primer]: http://categorically-abstract.tumblr.com/post/37812006963/property-based-testing-primer
[monoid-comment]: http://www.haskell.org/pipermail/haskell-cafe/2009-January/053603.html
[monoid-prefs]: http://www.haskell.org/pipermail/haskell-cafe/2009-January/053721.html
[finger-tree]: http://apfelmus.nfshost.com/articles/monoid-fingertree.html
[regex]: http://blog.sigfpe.com/2009/01/fast-incremental-regular-expression.html
