Property based testing is a testing method made popular by the Haskell
QuickCheck <sup>[\[1\]](#qc)</sup><a name="1"></a> library. Proponents of property based testing
might argue that xUnit frameworks don't automate enough of the testing task. They leave the programmer
to manually generate test data.

Property based testing automates test data generation. The technique works like this:
1. The programmer states a property, which is true for any data of the appropriate type.
2. The programmer supplies a way to generate arbitrary data of the appropriate type.
3. The testing framework generates hundreds of arbitrary values to test the property. If any of the
generated values falsifies the property, it reports that value. Otherwise it reports the number of
successful attempts it made.

Let me illustrate with some examples. I'll be using the [node-quickcheck][node-qc] library. It's an
extremely simple implementation that's missing some key features<sup>[\[2\]](#qc-py)</sup><a name="2"></a>,
but it works well for demonstration purposes, and the source code is very easy to understand.

Here's a simple property of string concatenation: the length of the concatenation of two strings is
equal to the sum of the lengths of those strings. At a node console:

    > function str_concat_prop(a, b) { return (a+b).length === a.length + b.length }
    > qc = require('quickcheck')
    > qc.forAll(str_concat_prop, qc.arbString, qc.arbString);
    +++ OK, passed 100 tests.

And here's what a failing test looks like:

    > function propertyEven(x) { return x % 2 == 0; }
    > qc.forAll(propertyEven, qc.arbByte);
    *** Failed!
    11

## Abstract Math and Property Based Testing

A blog whose stated purpose is to argue the benefit of modelling abstract concepts directly first detours
into a post on property based testing. Why?

The abstractions I'm going to model come with properties. One large benefit for directly modeling them
is automated test generation for these properties on all the concrete instances of these abstractions.
I'll be testing the associativity property of addition below, which is a special case of a general property
of all monoidal operators. When I declare a type a Monoid, in addition to adding a generic interface to that
type, I can also get a suite of tests for very little work.

## The API

Most QuickCheck ports for dynamic languages contain two important things: a checker and a variety of
arbitrary data generators. In the previous code, the checker is `forAll`, and `arbString` and `arbByte`
were used to generate arbitrary strings and bytes.

`forAll` takes a property as it's first argument. The rest of the arguments are generator functions,
which will be invoked with no arguments to get arbitrary values that will then be used as arguments for
the property.

This library also offers a few generators. `arbByte` gives an random uniformly distributed integer in the
range [0-255]. `arbChar` gives a character, `arbString` a string, and `arbBool` does a fair coin flip.
It also has a generator factory for arrays, `arbArray`, which takes a generator and returns a generator
that yields arrays of random length from 0 to 100 whose elements are created by the supplied generator.
So `arbArray(arbByte)` will yield successive arrays of between 0 and 100 bytes.

There are two more generator functions, but they have some unexpected properties. They make a good example
of property based testing.

## Numbers and Equality

`arbInt` and `arbDouble` are especially interesting generators provided by the qc library. Let's use them
to test associativity of addition. 

    > function prop_sum_associativity(a, b, c) { return a + (b+c) === (a+b) + c }
    > qc.forAll(prop_sum_associativity, qc.arbDouble, qc.arbDouble, qc.arbDouble);
    *** Failed!
    -1.117531802955579e+308,1.101464035399532e+308,-3.0497536018773165e+307
    > qc.forAll(prop_sum_associativity, qc.arbByte, qc.arbByte, qc.arbByte);
    +++ OK, passed 100 tests.

Many programmers know a few things about floating point imprecision, and regard it as a bug to compare
floats for equality. The arbitrary bytes all pass with addition, just as we'd expect, since there's no
imprecision issues with adding integers of such small magnitude. But there's more going on here. Let's
try out a simple check for approximate equality.

    > Number.eqDelta = 1e-8
    > Number.prototype.eq = function(a, b) { return Math.abs(a-b) < Number.eqDelta }
    > function prop_sum_associativity(a, b, c) { return (a+(b+c)).eq((a+b)+c) }
    > qc.forAll(prop_sum_associativity, qc.arbDouble, qc.arbDouble, qc.arbDouble);
    *** Failed!
    -9.978852290214801e+307,1.3645480265786847e+308,-5.20595870142343e+307

Hmm. Our naive check for approximate equality doesn't work very well for high magnitude values. High
magnitude values are also imprecise, even when the value represented is an integer. Let's give this
another try:

    > Number.prototype.eq = function(a, b) { return Math.abs(a/b - 1 ) < Number.eqDelta }
    > qc.forAll(prop_sum_associativity, qc.arbDouble, qc.arbDouble, qc.arbDouble);
    *** Failed!
    -1.6821833463461643e+308,-1.7370330545041583e+307,1.0744120916385978e+308

What happened here? Maybe we should check this sum.

    > function sum(a, b, c) { return a + b + c; }
    > sum(-1.6821833463461643e+308,-1.7370330545041583e+307,1.0744120916385978e+308)
    -Infinity

The addition overflowed to `-Infinity` when we added the first two numbers first. Then we added
a positive number to `-Infinity`, which is still `-Inifinity`. But if you add a the second two
numbers first, and then add the first to that result, you get no overflow.

    > -1.6821833463461643e+308 + (-1.7370330545041583e+307 + 1.0744120916385978e+308)
    -7.814745601579823e+307

So at the high magnitude boundary cases, floating point addition just isn't associative. This isn't
a bug in floating point arithmetic. It's the most reasonable thing that addition could do without
casting to a higher precision data type. But it _is_ a bug for your code to use a naive equality
comparison, or even an approximation to it at extreme values, and still expect associativity to hold.

But you may be thinking, why does `arbDouble` only ever seem to generate such extreme numbers? These
aren't the sorts of doubles one encounters in typical applications. The answer is that it samples
doubles from a uniform distribution ranging from `-Number.MAX_VALUE` to `Number.MAX_VALUE`. If you
generate a random number between 0 and 1000, you'll expect most of the values to have 3 digits, one
tenth to have 2 digits, and about one onehundredth to have one digit. Likewise, if you get a random
value between `-e308` and `e308`, you expect the overwhelming majority to be in the magnitude of `e308`
or `e307`.

It turns out `arbInt` is implemented by flooring an `arbDouble`. Since the sample is always high magnitude
integers anyway, it turns out the result is the same as `abrDouble`.

    > qc.forAll(prop_sum_associativity, qc.arbInt, qc.arbInt, qc.arbInt);
    *** Failed!
    2.3561210728985633e+307,1.1122776667786118e+308,-9.35712340491941e+307

So it turns out this QuickCheck port is a bit too simple and a bit too naive to use for many projects.
I've been working on [a fork][adam-qc] of this with Jeremy Karmel that adds features and fixes bugs.
The API is still evolving, and the whole project isn't being thoroughly tested. We're doing this for fun,
so unless we start using it on a project the whole thing may never be more than a prototype.

I'd be remiss not to point out [another JavaScript][qc-js] port by Darrin Thompson. It has some rather
advanced features, uncluding shrinking, which attempts to simplify a counterexample to the minimal case
when a test does fail.

## Conclusion

The main take-away from the floating point addition example is this:

**Property based testing is frighteningly good at finding bugs.**

It revealed the boundary cases for associativity of addition with ease. With a better floating point
generator, it would easily find more flaws in our `eq` method: if both results are `0` or `NaN`, they
would not pass `eq`.

We don't get this for free. We have to write and maintain generators to create our test data. But those
generators are often small and reusable. More complex data generators are often very easily defined in
terms of simpler generators. Much of the difficulty is finding the invariants that software should maintain,
yet identifying and maintaining invariants is one of the most important and underused tools in good software
engineering. Property based testing makes it even more rewarding.

And for that small upfront cost, you get a test suite that gives you greater confidence in your code every
time you run it. Even if nothing in your code base has changed, running your test suite still has a chance
of finding latent bugs. This is a very powerful feature.

If you're still not convinced, watch John Hughes's [excellent presentation][video] on the virtues of
property based testing. And you should watch it even if you are convinced.

## Footnotes
<a name="qc">[1]</a> QuickCheck has been ported to a large number of programming languages and environments. For
a list of links, see the [wikipedia page][wiki]. [(back)](#1)  
<a name="qc-py">[2]</a> Python has a very nice [quick-check port][qc-py]. It integrates nicely with
python testing frameworks, allows users to specify bounds on arbitrary data generators where appropriate,
and makes sure to test those bounds first, which makes checking edge cases easier. And its source is
still straightforward and easy to understand. [(back)](#2)  

[node-qc]: https://github.com/mcandre/node-quickcheck
[qc-py]: https://github.com/dbravender/qc
[adam-qc]: https://github.com/adambaker/node-quickcheck
[qc-js]: https://bitbucket.org/darrint/qc.js
[wiki]: http://en.wikipedia.org/wiki/QuickCheck
[video]: http://www.youtube.com/watch?v=XgasxJWgZBM
