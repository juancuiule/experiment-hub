import { ExperimentFlow } from "@/lib/types";
import { validateExperiment } from "@/lib/validate";
import { experiment } from "@/src/data/experiment";
import { DataDebug, StateDebug } from "@/src/Debug";
import Experiment from "@/src/Experiment";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const revalidate = 0; // Disable caching to ensure fresh data on each request

function determineStartingNode(
  searchParams: { [key: string]: string | string[] | undefined },
  experiment: ExperimentFlow,
) {
  const keys = Object.keys(searchParams);
  const startNodes = experiment.nodes.filter((node) => node.type === "start");

  for (const node of startNodes) {
    if (node.props && keys.includes(node.props.param.key)) {
      if (node.props.param.value) {
        const paramValue = searchParams[node.props.param.key];
        if (paramValue === node.props.param.value) {
          return node.id; // Return the ID of the starting node
        }
      }
    }
  }

  return startNodes[0].id;
}

export default async function Home(props: Props) {
  const searchParams = await props.searchParams;
  const startingNode = determineStartingNode(searchParams, experiment);

  const errors = validateExperiment(experiment);

  if (errors.length > 0) {
    return (
      <div>
        <h1>Experiment Validation Errors</h1>
        <ul>
          {errors.map((error, index) => (
            <li key={index}>
              {error.code} - {error.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <>
    <StateDebug />
    <Experiment startingNode={startingNode} />
    <DataDebug />
  </>
}
