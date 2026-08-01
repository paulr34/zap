# Endpoint configuration generation

This guide is about the generated endpoint configuration: what it contains, how
ZAP produces it, and how a template takes control of that output. It is written
for SDK integrators, in particular for the Matter SDK, where the endpoint
configuration is compiled into firmware and every byte of it costs flash.

- [What the endpoint configuration is](#what-the-endpoint-configuration-is)
- [How generation is layered](#how-generation-is-layered)
- [Taking control from a template](#taking-control-from-a-template)
- [Leaving metadata out for code driven clusters](#leaving-metadata-out-for-code-driven-clusters)
- [Helper reference](#helper-reference)
- [Row reference](#row-reference)
- [Replacing a helper instead](#replacing-a-helper-instead)
- [Migrating a template](#migrating-a-template)

## What the endpoint configuration is

A `.zap` file says which endpoints exist, which clusters are enabled on them,
and how every attribute is configured. Generation turns that into a set of C
tables that the SDK compiles in, for example in the Matter SDK through
`src/app/zap-templates/templates/app/endpoint_config.zapt`:

| Generated table              | Holds                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| `GENERATED_ATTRIBUTES`       | one metadata entry per enabled attribute                                    |
| `GENERATED_CLUSTERS`         | one entry per enabled cluster, with indexes into the tables above and below |
| `GENERATED_COMMANDS`         | accepted and generated command identifiers                                  |
| `GENERATED_EVENTS`           | event identifiers                                                           |
| `GENERATED_ENDPOINT_TYPES`   | one entry per endpoint type, with the index of its first cluster            |
| `GENERATED_DEFAULTS`         | default values that do not fit inline                                       |
| `GENERATED_MIN_MAX_DEFAULTS` | default, minimum and maximum of range checked attributes                    |
| `FIXED_*`                    | per endpoint arrays: identifier, profile, parent, network, device types     |

The tables are cross referenced by index. A cluster entry points at a range of
the attribute table, an endpoint type entry points at a range of the cluster
table, and an attribute entry can point into the defaults or the min/max table.
Whatever changes the contents of one table has to keep those indexes right,
which is the reason for the structure described below.

## How generation is layered

Generation runs in three layers. The split matters because it decides what a
template can change.

```
{{#endpoint_config}}                     collection
  session database -> lists of rows      src-electron/generator/helper-endpointconfig.js
        |
        v
  row -> C tokens                        formatting
                                         src-electron/generator/endpointconfig-format.js
        |
        v
  tokens -> generated file               layout
                                         the template, or the aggregate helpers
```

**Collection** happens once, when `{{#endpoint_config}}` opens. It reads the
session, resolves attribute types, sizes and default values, sorts everything
into the order the tables need, and calculates the indexes and counts that tie
the tables together. The result is a set of plain lists on the block context:
`attributeList`, `clusterList`, `commandList`, `eventList`, `endpointList`,
`minMaxList`, `reportList`, `longDefaultsList` and the manufacturer code lists.

**Formatting** turns one row into the C tokens for that row: an attribute mask
into `ZAP_ATTRIBUTE_MASK(WRITABLE) | ZAP_ATTRIBUTE_MASK(NULLABLE)`, a default
value into `ZAP_SIMPLE_DEFAULT(0x8000)`, and so on. These are pure functions,
which is what lets the aggregate helpers and the per row helpers produce exactly
the same text.

**Layout** decides where those tokens end up. There are two ways to do it:

- the aggregate helpers, such as `{{endpoint_attribute_list}}`, which return a
  whole table as one string, with the layout fixed in javascript;
- the iterators, such as `{{#endpoint_attributes}}`, which hand the template one
  row at a time and let it write the table itself.

Both are supported, and both can be used in the same template. Nothing has to
be migrated in one step.

## Taking control from a template

The Matter SDK generates the attribute table like this:

```handlebars
#define GENERATED_ATTRIBUTES
{{endpoint_attribute_list order='default,id,size,type,mask'}}
```

The same table, written out in the template:

```handlebars
#define GENERATED_ATTRIBUTES { \
{{#endpoint_attributes}}
  {{#if isNewComment}}
    \ /*
    {{comment}}
    */ \
  {{/if}}
  {
  {{endpoint_attribute_items order='default,id,size,type,mask'}}
  }, /*
  {{name}}
  */ \
{{/endpoint_attributes}}
}
```

Those two produce identical output, byte for byte. There is a test that asserts
it, for the attribute, min/max, cluster, command, endpoint type, defaults,
manufacturer code and fixed array tables:
`test/gen-template/matter3/endpoint_config_iterators.zapt`.

That equality is the point of the iterators. An SDK can move a table into its
own template without any churn in the generated file, confirm that the output
did not change, and only then start changing the part it cares about. For
example, spelling out the fields instead of using `endpoint_attribute_items`:

```handlebars
{{#endpoint_attributes}}
  {
  {{endpoint_attribute_default}},
  {{id}},
  {{size}},
  {{type}},
  {{endpoint_attribute_mask}}
  }, /*
  {{clusterName}}.{{name}}
  */ \
{{/endpoint_attributes}}
```

or emitting something different for one group of clusters:

```handlebars
{{#endpoint_attributes}}
  {{#if_endpoint_cluster_in 'Descriptor,Identify'}}
    //
    {{clusterName}}.{{name}}
    is provided by the cluster implementation
  {{else}}
    {
    {{endpoint_attribute_items}}
    }, /*
    {{name}}
    */ \
  {{/if_endpoint_cluster_in}}
{{/endpoint_attributes}}
```

Two things are worth knowing when writing these loops:

- Rows carry `index` and `count`, which are the position in the iteration, so
  `{{#first}}`, `{{#last}}`, `{{#not_last}}` and `{{#middle}}` work inside every
  iterator. Where a row has an index of its own into a generated table, it is
  named for what it is, `offset` for long defaults and `entryIndex` for
  manufacturer codes, so that it cannot be confused with the position.
- Rows that belong to the same cluster carry the same `comment`, and the first
  row of each group has `isNewComment` set. That is how the group headers of the
  aggregate helpers are reproduced.

## Leaving metadata out for code driven clusters

A code driven cluster in the Matter SDK implements `ServerClusterInterface` and
keeps its own attribute, command and event metadata in C++. Generating the same
metadata into the ember tables as well costs flash and buys nothing.

Filtering rows in the template is not enough for that, because the counts and
the indexes of the other tables were already calculated over the full lists.
Dropping a row in the layout layer would leave the cluster table pointing at the
wrong place. The rows have to disappear during collection, so
`{{#endpoint_config}}` takes the list of clusters to leave out:

```handlebars
{{#endpoint_config
  allowUnknownStorageOption="false"
  spaceForDefaultValue=4
  omitAttributeMetadataClusters="Energy EVSE,0x0025"
}}
```

For every named cluster:

- its attributes do not appear in `GENERATED_ATTRIBUTES`, and do not consume
  space in the attribute store, the defaults blob, the min/max table or the
  reporting table;
- the cluster keeps its entry in `GENERATED_CLUSTERS`, with an attribute count
  of zero, so endpoint composition and cluster lookup do not change;
- all indexes and counts are calculated over what is left, so the tables stay
  consistent.

`omitCommandMetadataClusters` and `omitEventMetadataClusters` do the same for
the command and event tables.

Everything of that cluster is left out, including the global attributes such as
`FeatureMap` and `ClusterRevision`. Only name a cluster here when its
implementation answers reads and writes for all of its attributes itself, which
is exactly what a code driven cluster does.

Clusters are named either by name, case insensitively, or by code in any
numeric notation. Prefer the code when a name contains a slash, such as On/Off,
because handlebars reads a slash inside a block tag as the start of the closing
tag. Entries are separated by commas or by newlines.

Rows of a cluster whose metadata was left out report it, which is useful when a
template generates something else in its place:

```handlebars
{{#endpoint_clusters}}
  {{#if omitsAttributeMetadata}}
    //
    {{clusterName}}
    manages its own attributes
  {{/if}}
{{/endpoint_clusters}}
```

## Helper reference

All helpers below are used inside `{{#endpoint_config}}`.

### Iterators

| Helper                                              | Iterates                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `{{#endpoint_attributes}}`                          | attributes, in attribute table order                             |
| `{{#endpoint_clusters}}`                            | clusters, in cluster table order                                 |
| `{{#endpoint_commands}}`                            | commands, in command table order                                 |
| `{{#endpoint_events}}`                              | events, in event table order                                     |
| `{{#endpoint_types}}`                               | endpoint types                                                   |
| `{{#endpoint_fixed_endpoints}}`                     | endpoints, with everything the `FIXED_*` arrays need             |
| `{{#endpoint_device_types}}`                        | device types, one row per device type per endpoint               |
| `{{#endpoint_min_max_defaults}}`                    | attributes that have a minimum and a maximum                     |
| `{{#endpoint_reporting_defaults}}`                  | attributes that have reporting enabled                           |
| `{{#endpoint_long_defaults}}`                       | default values that do not fit inline                            |
| `{{#endpoint_manufacturer_codes type="attribute"}}` | manufacturer code pairs, for `attribute`, `command` or `cluster` |

### Formatting the current row

| Helper                                                   | Returns                                                |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `{{endpoint_attribute_mask}}`                            | attribute mask expression                              |
| `{{endpoint_attribute_default}}`                         | default value expression, takes `endian` and `pointer` |
| `{{endpoint_attribute_items order=...}}`                 | the whole attribute row body                           |
| `{{endpoint_cluster_mask}}`                              | cluster mask expression                                |
| `{{endpoint_command_mask}}`                              | command mask expression                                |
| `{{endpoint_reporting_mask}}`                            | mask of a reporting row                                |
| `{{endpoint_reporting_items order=... minmaxorder=...}}` | the whole reporting row body                           |
| `{{endpoint_min_max_items order=...}}`                   | the whole min/max row body                             |
| `{{endpoint_min_max_default}}`                           | default of a min/max row                               |
| `{{endpoint_min_max_min}}`                               | minimum of a min/max row                               |
| `{{endpoint_min_max_max}}`                               | maximum of a min/max row                               |
| `{{endpoint_long_default_value endian=...}}`             | bytes of a long default value                          |

### Conditionals

| Helper                                   | Runs its body when                           |
| ---------------------------------------- | -------------------------------------------- |
| `{{#if_endpoint_cluster_in "A,0x0006"}}` | the row belongs to one of the named clusters |
| `{{#if_endpoint_cluster_server}}`        | the row belongs to a server side cluster     |

Rows are matched by the cluster they belong to, never by their own name or code,
so `{{#if_endpoint_cluster_in "Identify"}}` inside `{{#endpoint_attributes}}`
selects the attributes of Identify. Clusters are named the same way as in
`omitAttributeMetadataClusters`, by name or by code.

### Aggregate helpers

The aggregate helpers are unchanged and remain supported:
`endpoint_attribute_list`, `endpoint_cluster_list`, `endpoint_command_list`,
`endpoint_types_list`, `endpoint_attribute_min_max_list`,
`endpoint_reporting_config_defaults`, `endpoint_attribute_long_defaults`, the
`endpoint_*_manufacturer_codes` helpers, the `endpoint_fixed_*` helpers and all
of the counts. See [ZAP Template Helpers](helpers.md) for the generated
reference of every one of them.

## Row reference

Every row carries `index` and `count` for the iteration, and the fields below.

**Attributes** (`{{#endpoint_attributes}}`)

`id`, `type`, `size`, `mask`, `defaultValue`, `isMacro` are the generated
values. `code`, `name`, `define`, `zclType`, `storage`, `storageSize`,
`isWritable`, `isReadable`, `isNullable`, `isSingleton`, `isReportable`,
`manufacturerCode` describe the attribute. `endpointId`, `clusterId`,
`clusterCode`, `clusterName`, `clusterSide`, `comment`, `isNewComment` say where
it came from.

**Clusters** (`{{#endpoint_clusters}}`)

`clusterId`, `clusterCode`, `clusterName`, `clusterDefine`, `clusterSide`,
`manufacturerCode`, `endpointId`, `attributeIndex`, `attributeCount`,
`attributeSize`, `eventIndex`, `eventCount`, `commandCount`, `mask`,
`functions`, `commands`, `comment`, and `omitsAttributeMetadata`,
`omitsCommandMetadata`, `omitsEventMetadata`.

**Commands** (`{{#endpoint_commands}}`)

`clusterId`, `clusterCode`, `clusterName`, `clusterSide`, `commandId`, `code`,
`name`, `source`, `isIncoming`, `isOutgoing`, `manufacturerCode`, `mask`,
`responseName`, `responseId`, `endpointId`, `comment`, `isNewComment`.

**Events** (`{{#endpoint_events}}`)

`eventId`, `code`, `name`, `manufacturerCode`, `endpointId`, `clusterId`,
`clusterCode`, `clusterName`, `clusterSide`, `comment`, `isNewComment`.

**Endpoint types** (`{{#endpoint_types}}`)

`clusterIndex`, `clusterCount`, `attributeSize`, `endpointId`,
`endpointTypeName`, `deviceIdentifier`, `deviceVersion`.

**Endpoints** (`{{#endpoint_fixed_endpoints}}`)

`endpointId`, `endpointIdHex`, `profileId`, `profileIdHex`, `networkId`,
`parentEndpointIdentifier`, `parentId`, `endpointTypeIndex`, `endpointTypeName`,
`deviceTypeCount`, `deviceTypeOffset`. `parentId` is `kInvalidEndpointId` when
there is no parent, which is what the generated array expects.

**Device types** (`{{#endpoint_device_types}}`)

`endpointId`, `deviceId`, `deviceIdHex`, `deviceVersion`, `indexOnEndpoint`,
`deviceTypeCountOnEndpoint`. An endpoint type that carries no device identifier
produces no row, and is not counted in the `deviceTypeCount` and
`deviceTypeOffset` of its endpoint, which matches what the generated device type
array contains.

**Min/max** (`{{#endpoint_min_max_defaults}}`)

`default`, `min`, `max`, `typeSize`, `isTypeSigned`, `name`, `code`,
`endpointId`, `clusterCode`, `clusterName`, `clusterSide`, `comment`,
`isNewComment`.

**Reporting** (`{{#endpoint_reporting_defaults}}`)

`direction`, `endpoint`, `clusterId`, `attributeId`, `mask`, `mfgCode`,
`minOrSource`, `maxOrEndpoint`, `reportableChangeOrTimeout`, `name`, `code`,
`clusterCode`, `clusterName`, `clusterSide`, `comment`, `isNewComment`.

**Long defaults** (`{{#endpoint_long_defaults}}`)

`value`, `size`, `offset`, `type`, `name`, `code`, `endpointId`, `clusterCode`,
`clusterName`, `clusterSide`, `comment`, `isNewComment`. The `offset` is where
the value sits in the defaults blob, which is what the attribute table refers
to.

**Manufacturer codes** (`{{#endpoint_manufacturer_codes}}`)

`entryIndex`, `mfgCode`. The `entryIndex` is the position in the matching
generated table. The list is empty for most configurations, so use the
`{{else}}` branch for the placeholder entry that the tables need.

## Replacing a helper instead

Sometimes an SDK needs logic that does not belong in a template. Helpers listed
under `"helpers"` in `gen-templates.json` are loaded after the built-in ones, so
an export with the same name as a built-in helper replaces it for that template
package. Reimplementing `endpoint_attribute_list` in the SDK is therefore a
supported option, and needs no changes in ZAP. See
[ZAP External Template Helpers](external-helpers.md).

The iterators are usually the better tool, because the SDK then only owns the
layout, and the collection of the data, its ordering and the index arithmetic
stay in ZAP where they are tested.

## Migrating a template

1. Pick one table and keep everything else as it is.
2. Replace the aggregate helper with the equivalent loop from
   [Taking control from a template](#taking-control-from-a-template).
3. Generate and diff against the previous output. It should be identical.
4. Now make the change you wanted: reorder fields, add comments, or leave rows
   out with `omitAttributeMetadataClusters`.
5. Repeat for the next table.

One detail that is easy to miss: the aggregate helpers end their output with a
newline. When comparing output during a migration, close the tag with `~}}` to
drop the newline that the template would add on top of it.
