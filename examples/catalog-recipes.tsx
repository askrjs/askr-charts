import { createPlot } from "@askrjs/charts";

interface RecipeRow {
  id: string;
  group: string;
  series: string;
  value: number;
  target: number;
  weight: number;
}

const RecipePlot = createPlot<RecipeRow>();
const rows: readonly RecipeRow[] = [
  { id: "mon-api", group: "Mon", series: "API", value: 4, target: 6, weight: 3 },
  { id: "mon-worker", group: "Mon", series: "Worker", value: 2, target: 6, weight: 5 },
  { id: "tue-api", group: "Tue", series: "API", value: 7, target: 8, weight: 7 },
  { id: "tue-worker", group: "Tue", series: "Worker", value: 3, target: 8, weight: 4 },
  { id: "wed-api", group: "Wed", series: "API", value: 9, target: 10, weight: 8 },
  { id: "wed-worker", group: "Wed", series: "Worker", value: 5, target: 10, weight: 6 },
];

export function CatalogRecipes() {
  return (
    <>
      <RecipePlot.Root
        data={rows}
        rowKey="id"
        label="Grouped and stacked service volume"
        height={240}
      >
        <RecipePlot.Scale name="grouped-x" channel="x" type="band" />
        <RecipePlot.Bar
          x={(row) => `${row.group} · ${row.series}`}
          y="value"
          xScale="grouped-x"
          fill="series"
        />
        <RecipePlot.Bar x="group" y="value" stack="series" fill="series" opacity={0.42} />
        <RecipePlot.Legend interactive label="Service" />
      </RecipePlot.Root>

      <RecipePlot.Root
        data={rows.filter(({ series }) => series === "API")}
        rowKey="id"
        label="Compact request sparkline"
        height={160}
      >
        <RecipePlot.Scale name="spark-x" channel="x" type="point" />
        <RecipePlot.Scale name="spark-y" channel="y" type="power" exponent={0.75} />
        <RecipePlot.Area x="group" y="value" xScale="spark-x" yScale="spark-y" />
        <RecipePlot.Line x="group" y="value" xScale="spark-x" yScale="spark-y" />
      </RecipePlot.Root>

      <RecipePlot.Root data={rows} rowKey="id" label="Logarithmic service bubble plot" height={240}>
        <RecipePlot.Scale name="bubble-x" channel="x" type="log" domain={[1, 12]} />
        <RecipePlot.Scale name="bubble-y" channel="y" type="symlog" constant={2} />
        <RecipePlot.Point
          x="value"
          y="target"
          r="weight"
          xScale="bubble-x"
          yScale="bubble-y"
          fill="series"
        />
        <RecipePlot.Tooltip mode="mark" channels={["value", "target", "weight", "series"]} />
      </RecipePlot.Root>

      <RecipePlot.Root data={rows.slice(0, 4)} rowKey="id" label="Service share pie" height={220}>
        <RecipePlot.Arc value="value" category="series" innerRadius={0} padAngle={0.025} />
        <RecipePlot.Legend position="bottom" />
      </RecipePlot.Root>

      <RecipePlot.Root data={rows} rowKey="id" label="Continuous load heatmap" height={220}>
        <RecipePlot.Scale name="load-color" channel="color" type="continuous-color" />
        <RecipePlot.Cell x="group" y="series" value="value" colorScale="load-color" />
        <RecipePlot.Legend scale="load-color" label="Load" position="bottom" />
      </RecipePlot.Root>
    </>
  );
}
