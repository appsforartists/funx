[![Join the chat at https://gitter.im/appsforartists/funx](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/appsforartists/funx?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Overview ##

Funx is an experiment in functionally-reactive Flux.  

Most web pages present collections of data, and provide the user the ability to select a subset of that data to view in greater detail.  For instance, the [Bike Index](https://bikeindex.org/) is a collection of bikes.  A subset of those bikes are stolen.  The user may chose to see a particular bike, which is just another subset.

In Funx, there are two types of stores - **_stateful_** and **_ephemeral_**.  Stateful stores are the sources of truth - they are the data you want to pass to the client in an isomorphic application.  Ephemeral stores can be entirely derived by combining stateful stores.  With a stateful `Bikes` store _(a [Map](http://facebook.github.io/immutable-js/docs/#/Map) of `bikeID`s to `BikeModel`s)_, deriving the `currentBike` is this simple:

```javascript
  "currentBike":  function (Bikes, routerState) {
                    return routerState.has("bikeID")
                      ? Bikes.getOrFetch(
                          {
                            "bikeID":  routerState.get("bikeID")
                          }
                        )
                      : null
                  },
```

Every time `Bikes` changes, Funx will run that function.  If its result has changed, `currentBike` will emit the new value.


## Status ##

Funx is primarily an intellectual exercise to find the optimal way to express data in isomorphic React projects.  I'm sure it contains both good and bad ideas, and I haven't had time to tease them apart yet.  In the coming weeks, I hope to explain my motivations in greater detail and start a conversation around these concepts.  That conversation will  inform whether or not it is worth evolving into a supported project.

**_This is an experiment._**  Use it to explore these concepts.  Don't use it in a production-quality app.


## Inspiration ##

 - **[Reflux](https://github.com/spoike/refluxjs)** _by [Mikael Brassman](https://github.com/spoike)_: Reflux's actions are simple functions and its stores may listen to one another.  There's no convention to direct where a store keeps its state (which makes serializing isomorphic stores difficult), and there's no concept of a store whose value is entirely derived from other stores.

- **[Nuclearmail](https://github.com/ianobermiller/nuclearmail)** _by Ian Obermiller_: Nuclearmail is an excellent example of a traditional Flux architecture in a very easy-to-read codebase.  Its actions hit an API, then send the result to its dispatcher, which forwards it to its stores.  In Ian's model, all stores are stateful.  He created a [`DependentStateMixin`](https://github.com/ianobermiller/nuclearmail/blob/master/src/js/DependentStateMixin.js) that accomplishes the same goal as Funx's ephemeral stores, with some limitations.


[![eBay Open Source](https://raw.githubusercontent.com/raptorjs/optimizer/ba5b56a3361f95d4ab6be5d6a6d53590315c3428/images/ebay.png)](https://github.com/eBay/)  
_Funx has been incubated in the [eBay](https://github.com/eBay/) Mobile Innovations lab._

