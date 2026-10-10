# Migrate to Charts 0.5.0

Charts keeps the typed plot factory, all 19 runtime functions, supported component/configuration/result types, and the root, styles, and package metadata entrypoints. The root contracts shrink from 100 names to 69 by retiring 31 named type aliases for channel algebra, descriptors, and shared implementation props.

Use the type of the concrete operation you are authoring. Public mark props preserve each mark's field, value, and cardinality constraints. For example, a line cannot accept the grouped aggregate channel permitted by some bar/area props. The underlying model definitions remain in the declarations wherever retained signatures need them; private package subpaths are unavailable.

```ts
import {
  constant,
  filterRows,
  type BarProps,
  type LineProps,
  type PlotFactory,
  type ScaleProps,
} from "@askrjs/charts";

interface Row {
  id: string;
  value: number;
}

type LineY = LineProps<Row>["y"];
type HistogramX = BarProps<Row>["x"];
type DomainElement = NonNullable<ScaleProps["domain"]>[number];
type LineComponent = PlotFactory<Row>["Line"];
type PrimitiveName = Exclude<keyof PlotFactory<Row>, "Root">;

const color = constant("#2563eb");
type ColorExpression = typeof color;
const positiveRows = filterRows<Row>((row) => row.value > 0);
type PositiveRowsTransform = typeof positiveRows;
```

Infer helper results rather than manually constructing branded expression or row-transform records. A wrapper can use `Pick` or `Omit` over its specific component prop type. Independently reusable field/accessor algebra belongs in application-owned types. `PrimitiveName` deliberately excludes `Root`, matching the retired primitive-only selector.

Every removal is listed below; none changes runtime behavior.

| Removed root type               | Migration                                                                                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AggregatedNumericChannelInput` | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `AggregateOperation`            | Call count(), sum(input), or mean(input); keep internal transform discriminant definitions.                                                                                                                             |
| `BinnedScaleChannelInput`       | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `CartesianMarkProps`            | Use BarProps/LineProps/AreaProps/PointProps/ArcProps/CellProps/RectProps/RuleProps/TextProps, with Pick/Omit for an app-owned wrapper contract.                                                                         |
| `CategoricalField`              | Use specific public mark/root/helper option property types, or application-local Extract<keyof Row,string> / mapped types where independently needed.                                                                   |
| `ChannelExpression`             | Infer the return type from constant/bin/count/sum/mean/etc.; reusable annotations may use the specific public helper ReturnType or concrete mark prop channel type.                                                     |
| `ChannelExpressionKind`         | Infer the return type from constant/bin/count/sum/mean/etc.; reusable annotations may use the specific public helper ReturnType or concrete mark prop channel type.                                                     |
| `ChannelInput`                  | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `ColorChannelInput`             | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `FieldOfType`                   | Use specific public mark/root/helper option property types, or application-local Extract<keyof Row,string> / mapped types where independently needed.                                                                   |
| `MarkBaseProps`                 | Use BarProps/LineProps/AreaProps/PointProps/ArcProps/CellProps/RectProps/RuleProps/TextProps, with Pick/Omit for an app-owned wrapper contract.                                                                         |
| `NumericChannelInput`           | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `NumericField`                  | Use specific public mark/root/helper option property types, or application-local Extract<keyof Row,string> / mapped types where independently needed.                                                                   |
| `PlotChannelValue`              | Use the relevant mark prop type or declare a local value union for application transport values; keep internal definitions reachable from public signatures.                                                            |
| `PlotScalar`                    | Use the relevant mark prop type or declare a local value union for application transport values; keep internal definitions reachable from public signatures.                                                            |
| `PrimitiveComponent`            | Use PlotFactory<Row>["Line"] (or another component member) for a component annotation; use Exclude<keyof PlotFactory<Row>, "Root"> for the exact primitive-only selector union. Internal compiler kinds remain private. |
| `PrimitiveKind`                 | Use PlotFactory<Row>["Line"] (or another component member) for a component annotation; use Exclude<keyof PlotFactory<Row>, "Root"> for the exact primitive-only selector union. Internal compiler kinds remain private. |
| `RowAccessor`                   | Use contextual typing from the specific prop/helper option, or a local (row:Readonly<Row>,index:number)=>Value\|null\|undefined callback type.                                                                          |
| `RowChannelInput`               | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `RowColorChannelInput`          | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `RowField`                      | Use specific public mark/root/helper option property types, or application-local Extract<keyof Row,string> / mapped types where independently needed.                                                                   |
| `RowNumericChannelInput`        | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `RowScaleChannelInput`          | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `RowTextChannelInput`           | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `RowTransform`                  | Infer helper returns or use the specific mark prop transform type; do not manually construct branded descriptor records.                                                                                                |
| `RowTransformKind`              | Infer helper returns or use the specific mark prop transform type; do not manually construct branded descriptor records.                                                                                                |
| `ScaleChannelInput`             | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |
| `ScaleDomainValue`              | Use NonNullable<ScaleProps["domain"]>[number] when a named domain element type is needed.                                                                                                                               |
| `ScaleField`                    | Use specific public mark/root/helper option property types, or application-local Extract<keyof Row,string> / mapped types where independently needed.                                                                   |
| `TemporalField`                 | Use specific public mark/root/helper option property types, or application-local Extract<keyof Row,string> / mapped types where independently needed.                                                                   |
| `TextChannelInput`              | Use the specific public mark prop, e.g. LineProps<Row>["y"], BarProps<Row>["x"], ArcProps<Row>["value"], or PointProps<Row>["fill"]. Keep all underlying generic definitions in declarations.                           |

Continue importing `@askrjs/charts/styles` explicitly. Immutable append/upsert/remove/trim helpers remain supported for application-owned live row arrays. Plot exports still capture the current scene when called; a pending PNG may finish after root cleanup. See the [complete API decision matrix](./0.5.0-public-api.md).
