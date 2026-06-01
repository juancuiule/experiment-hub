# Data Keys and Special Characters

In order to reference values collected in the experiment context we will use a `$$path.to.dataKey` notation. This means that if we have a data key called `age` that is being collected in the experiment, we can reference it in the condition config of a branch node as `$$age`. It supports the dot notation to reference nested data, so if we have a data key called `demographics` that is an object with an `age` property, we can reference it as `$$demographics.age`.

In order to reference values from the current loop we use the `@` notation to access `context.loopData`. The path format is `@loopNodeId.field` where `loopNodeId` is the `id` of the loop node and `field` is either `value` (the current iteration string) or `index` (the zero-based iteration count). For example, if a loop node has `id: "loop-sports"`, the current value is `@loop-sports.value` and the index is `@loop-sports.index`.

Inside a `for-each` component, the current item is accessed with the `#` prefix via `context.screenData.foreachData`. The path format is `#foreachId.field` where `foreachId` is the `id` of the `for-each` component and `field` is either `value` or `index`. For example, if a `for-each` has `id: "foreach-sport"`, use `{{#foreach-sport.value}}` in the template component's props.

We will also be using `$` (a single dollar sign) to reference values from the current screen. This is useful to be able to use values from the current screen to show or hide another component in the same screen based on the interaction of the participant with the first component. For example if we ask a participant if they have children (with a yes/no boolean component) we may use that `$hasChildren` value to show a new component asking how many children do they have only if the answer to the first question is yes.

## Summary

| Prefix | Scope                  | Example                             |
| ------ | ---------------------- | ----------------------------------- |
| `$$`   | Experiment-wide data   | `$$demographics.age`                |
| `@`    | Loop item (by loop node ID) | `@loop-sports.value`, `@loop-sports.index` |
| `$`    | Current screen         | `$hasChildren`                      |
| `#`    | For-each item (by for-each component ID) | `#foreach-sport.value`, `#foreach-sport.index` |

Localized static copy uses a separate token, `[[key]]`, which resolves against the active locale's dictionary rather than runtime data. It is wrapped in `[[ ]]` (not `{{ }}`) and is documented in [i18n](./i18n.md).
