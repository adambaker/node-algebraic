This blog exists to demonstrate a point: very abstract mathematical concepts are worth modeling
directly in your programs. Abstract algebra and category theory give us concepts like monoids,
groups, rings, lattices, fields, functors, monads, etc. Other bloggers have written a lot of good
material on how these concepts offer design insights, such as [Dave Fayram's article][monad-ruby]
on monadic patterns in ruby, [John Bender's article][js-category] on categories and functors in
javascript, and [Gabriel Gonzalez's article][functor-pattern] on Functor's as a design pattern.

But these articles focus on design insights and patterns, not modelling these patterns directly.
Gonzalez talks about functors, which are modeled directly in Haskell, but the focus of his article
is on implicit functors in Haskell and the design philosophy behind them. Bender models a single
functor, not the general concept, and focuses on the insights from the exercise, not the benefits
of using his model. Dave Fayram says Haskell "is one of the few environments where [monads] make
sense to model directly".

I will focus on practical benefits of modeling abstract mathematical structures directly. I value
the design patterns these author's are exposing, and will link to similar articles in future posts.
But you may think that these patterns are only guides, and perhaps not too important to the actual
practice of solving programming problems. You may think that some of these are too abstract to gain
much practical value by modeling them directly. I aim to demonstrate their value.

I will focus on four kinds of benefits for each abstraction I consider:

1. Modularity of designed that comes from programming an abstract interface. You can changed the
behavior of your code with minimal effort when that change involes swapping one monoid or functor
for another.

2. Improved testing. Most of these objects have axioms or laws, constraints on their behavior. These
provide ready properties for testing, using _property based testing_ methods to check those properties
with computer generated data.

3. More accurate reasoning about your code. The interface and laws associated with an abstraction
form a contract, which allows you to make assuptions and reason about invariants. They also tend
to have some intuitive purpose, which helps communicating the intent of your code.

4. Easier performance optimizations. The laws associated with these abstractions are typically
equivalences. This means that you can substitute one statement for another more efficient statement
without affecting the correctness of your code. They aid in reasoning about parallelism, informing
how a computation can be restructured to run across multiple cores.

Throughout I'll be using JavaScript on Node.js. The code I've written for these posts can be found
here:
[https://github.com/adambaker/node-algebraic](https://github.com/adambaker/node-algebraic)

I may switch to using JRuby or port my examples to a similar language in the future.

I hope you find these useful and interesting.

[monad-ruby]: http://dave.fayr.am/posts/2011-10-4-rubyists-already-use-monadic-patterns.html
[functor-pattern]: http://www.haskellforall.com/2012/09/the-functor-design-pattern.html
[js-category]: http://johnbender.us/2012/02/29/faster-javascript-through-category-theory/
