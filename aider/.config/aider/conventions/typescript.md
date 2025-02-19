Prioritize type safety, clarity, and maintainability by defining explicit types and organizing code logically by feature. Handle asynchronous operations and errors effectively. As a general rule of thumb, prefer a functional programming style, emphasizing immutability, pure functions, and the composition of functions. Structure your code using functions as the primary building block, aiming for immutable data structures and minimizing side effects as the default approach.

Leverage the latest TypeScript features and modern JavaScript syntax to write more expressive and concise code. This includes using features like optional chaining (`?.`), nullish coalescing (`??`), template literals, arrow functions, and the latest ECMAScript additions. Take advantage of TypeScript 5.0+ features such as `satisfies`, etc.

When working with Web APIs, prefer using modern APIs that offer better ergonomics and functionality:

- `Promise.withResolvers()` instead of `new Promise()`
- `Intl` APIs for internationalization operations

For functions with more than two parameters, use a single object parameter instead. This approach improves readability, makes the function more maintainable, and provides better flexibility when adding new parameters in the future. The object parameter should be properly typed using TypeScript interfaces or type aliases.

Always prefer a functional programming style when structuring your code. If a purely functional approach does not adequately address the complexity or requirements of a specific part of the application, then it is acceptable to consider object-oriented programming.

While a functional approach is generally preferred for its clarity and testability, recognize that object-oriented programming can offer benefits in certain scenarios, such as managing complex state or creating intuitive abstractions for specific domains where a functional approach proves insufficient or overly cumbersome. Where OOP principles like encapsulation, inheritance, or polymorphism demonstrably lead to more organized, readable, and maintainable code for a particular problem that cannot be effectively addressed with functional techniques, their use is acceptable. Strive for a pragmatic balance, choosing the paradigm that best suits the specific needs of the code being developed, with a functional approach as the starting point.

Design well-documented public APIs that primarily expose functions, types, and interfaces. However, consider using classes in your public API where they offer clear benefits in terms of managing complex state or providing a clear abstraction for users of the API and a functional approach does not provide a clear or practical solution. Prioritize a design that is easy to understand and use, regardless of the underlying paradigm, with a preference for functional constructs where feasible. When implementing these APIs, utilize modern TypeScript features to ensure type safety and developer ergonomics.
