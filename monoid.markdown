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

Now we can combine strings in a nice line oriented matter if we want.

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

We have two constraints that apply to all monoids. We should make it easy to 

##Footnotes
<a name="formal">[1]</a> Typically, monoids are characterized in terms of a set, rather than
a data type. You can think of a type as a set containing all the possible instances of that
type. See [the Wikipedia page](https://en.wikipedia.org/wiki/Monoid#Definition) for the formal
definition. [(back)](#1)  
<a name="monoid-core">[2]</a> This is a simplified version of a more featureful implementation
in the [node-algebraic GitHub project][corejs]. [(back)](#2)  
<a name="monoid-instances">[3]</a> More featureful implementations of most of these, and a few
other monoids, can be found in [the instances][instancesjs] part of the that GitHub project.
[(back)](#3)  

[corejs]: https://github.com/adambaker/node-algebraic/blob/master/monoid/core.js
[instancesjs]: https://github.com/adambaker/node-algebraic/blob/master/monoid/instances.js
[project]: https://github.com/adambaker/node-algebraic/tree/master/monoid
[parallel]: https://github.com/adambaker/node-algebraic/blob/master/monoid/parallel.js
[worker]: https://github.com/adambaker/node-algebraic/blob/master/monoid/worker.js
[rivertrail]: https://github.com/RiverTrail/RiverTrail
