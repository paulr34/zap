# Code driven clusters

This guide is about clusters that are implemented in code rather than through
the attribute store that ZAP generates, what ZAP needs to know about them, and
how an SDK tells ZAP.

- [The problem](#the-problem)
- [Why the attribute access interface is not the signal](#why-the-attribute-access-interface-is-not-the-signal)
- [The metadata](#the-metadata)
- [What ZAP does with it](#what-zap-does-with-it)
- [Reading it from a template](#reading-it-from-a-template)
- [What is not covered yet](#what-is-not-covered-yet)

## The problem

In the Matter SDK a growing number of clusters implement
`ServerClusterInterface` and keep their own attribute state in C++. The bridge
between the generated configuration and such a cluster is its
`CodegenIntegration.cpp`, which creates the cluster for each endpoint that has
it enabled and fills in a configuration structure.

For those clusters, part of what ZAP does is redundant or meaningless:

- the attribute store holds values that the implementation of the cluster
  already holds, which costs RAM;
- the generated attribute metadata describes attributes that the cluster
  already describes, which costs flash;
- the storage choices that ZAP offers in the UI have no meaning. Saving such an
  attribute to NVM does not do anything, because nothing reads it from there.

What such a cluster does still want from ZAP is the configuration: which
endpoints have the cluster, which optional attributes and commands are enabled,
the feature map, and the **default values**. `CodegenIntegration` reads those
defaults to initialize its instances. So the answer is not "generate nothing",
it is "generate the configuration, not the storage".

ZAP could not express any of that, because it had no idea that a cluster is
implemented in code.

## Why the attribute access interface is not the signal

The closest thing ZAP had is the `attributeAccessInterfaceAttributes` list in
`zcl.json`, which forces the attributes it names to external storage.

That list answers a different question. It is about attributes that **cannot**
live in the attribute store, typically because they are lists or structs of
variable length. A cluster can have such attributes and still be an ordinary
ember cluster, and a code driven cluster is not described by that list either.
Reusing it to mean "implemented in code" would give the wrong answer in both
directions.

The two are also maintained for different reasons: one follows from the data
type of an attribute, the other from a decision about who implements a cluster.

## The metadata

An SDK describes its cluster implementations with a `clusterImplementation` key
in its `zcl.json`, either inline or as the name of a JSON file next to it:

```json
{
  "clusterImplementation": "cluster-implementation.json"
}
```

A separate file suits an SDK that generates this data from the source of truth
in its own tree, which is the expectation here: clusters are written and
converted in the SDK, so the SDK owns the list.

The file names clusters, says who implements them, and says what the
implementation needs from ZAP for each attribute:

```json
{
  "version": 1,
  "clusters": {
    "Energy EVSE": {
      "implementation": "code-driven",
      "attributes": {
        "*": "internal",
        "MinimumChargeCurrent": "default-only",
        "MaximumChargeCurrent": "default-only"
      }
    },
    "On/Off": {
      "implementation": "ember"
    }
  }
}
```

`implementation` is one of:

| Value         | Meaning                                                   |
| ------------- | --------------------------------------------------------- |
| `code-driven` | the implementation of the cluster holds its own state     |
| `ember`       | the attribute store holds the state, which is the default |

Attribute handling is one of:

| Value          | ZAP stores the value | ZAP generates the default | For                                                      |
| -------------- | -------------------- | ------------------------- | -------------------------------------------------------- |
| `internal`     | no                   | no                        | the implementation provides everything                   |
| `default-only` | no                   | yes                       | the implementation reads the default and holds the value |
| `any`          | yes                  | yes                       | ordinary attributes, the user chooses the storage        |

The `*` entry is the fallback for every attribute of that cluster. A code driven
cluster with no entry for an attribute is assumed to own it, since that is what
being implemented in code means. Cluster and attribute names are checked against
the ZCL that was loaded, so a typo is reported instead of quietly doing nothing.

## What ZAP does with it

**The cluster records who implements it.** `CLUSTER.IMPLEMENTATION` holds the
value, and it travels with the cluster everywhere ZAP hands one out, including
to the UI and to templates.

**Attribute handling becomes a storage policy.** ZAP already had a storage
policy per attribute, which decides what the user may choose and whether a
default value is of any use. Handling maps onto it:

| Handling       | Storage policy             | Storage option | Default value |
| -------------- | -------------------------- | -------------- | ------------- |
| `internal`     | `attributeAccessInterface` | External       | dropped       |
| `default-only` | `defaultOnly`              | External       | kept          |
| `any`          | `any`                      | user's choice  | kept          |

`defaultOnly` is new. It exists because "no space in the attribute store" and
"no default value" used to be the same thing, and for these clusters they are
not.

**The UI says so.** A code driven cluster is marked in the cluster list and in
the cluster detail view, with the reason it matters: enabling the cluster
configures the endpoint, but the cluster only works once the application creates
it. The storage of its attributes cannot be changed, and the tooltip explains
which of the two reasons applies. For a `default-only` attribute the default
value stays editable, because that value is the one thing ZAP still provides.

Global attributes, such as `FeatureMap` and `ClusterRevision`, have no cluster
of their own in the database. Their policy is recorded per cluster in the
package options, which is how the attribute access interface already handles
them.

## Reading it from a template

Cluster contexts carry `implementation`, and there is a helper for the common
case:

```handlebars
{{#if_cluster_code_driven}}
  //
  {{label}}
  is implemented in code
{{else}}
  //
  {{label}}
  uses the attribute store
{{/if_cluster_code_driven}}
```

The helper takes an optional cluster id, for contexts that are not a cluster:

```handlebars
{{#if_cluster_code_driven clusterId}}...{{/if_cluster_code_driven}}
```

Attributes carry `storagePolicy`, so a template can tell an attribute that needs
nothing from one that only needs its default value.

## What is not covered yet

This is the part of [zap#1698](https://github.com/project-chip/zap/issues/1698)
that makes ZAP aware of code driven clusters. The following belong with it and
are deliberately separate:

- **Generating defaults without the RAM buffer.** ZAP now knows which attributes
  only need their default value. Emitting those defaults while allocating no
  attribute store space, and reading them from flash, needs a decision on the
  ember side about the API for "get me the default value", and it changes
  generated output. The generation control that makes such a change expressible
  from a template is
  [zap#1684](https://github.com/project-chip/zap/issues/1684).
- **Direct pointers for strings**, so that a string default is referenced rather
  than copied into RAM. Same dependency as above.
- **The number of dynamic endpoints**, which is a separate flash optimisation and
  not a property of a cluster.
- **Guiding the user through what is left to do** after enabling a cluster, such
  as registering a delegate or creating an instance. That is
  [zap#1706](https://github.com/project-chip/zap/issues/1706), and it needs
  content from the SDK rather than a classification.
