import { validateExperiment } from '@/lib/flow-validation';
import { ExperimentFlow } from '@/lib/types';
import experiment from '@/src/data/experiments/pandemic';
import { DataDebug, StateDebug } from '@/src/Debug';
import Experiment from '@/src/Experiment';
import { ValidationErrors } from '@/src/ValidationErrors';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const revalidate = 0; // Disable caching to ensure fresh data on each request

function determineStartingNode(
  searchParams: { [key: string]: string | string[] | undefined },
  experiment: ExperimentFlow,
) {
  const keys = Object.keys(searchParams);
  const startNodes = experiment.nodes.filter((node) => node.type === 'start');

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
    return <ValidationErrors errors={errors} />;
  }

  return (
    <>
      <details className="my-2">
        <summary className="text-content-secondary cursor-pointer text-xs">
          Debug Info
        </summary>
        <StateDebug />
      </details>
      <Experiment startingNode={startingNode} experiment={experiment} />
      <details>
        <summary className="text-content-secondary cursor-pointer text-xs">
          Data Debug
        </summary>
        <DataDebug />
      </details>
    </>
  );
}
