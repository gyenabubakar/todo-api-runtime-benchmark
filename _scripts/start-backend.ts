import { Command, InvalidArgumentError } from "commander";

import { BACKENDS, BACKEND_PORT, BACKEND_SERVICE, type Backend } from "./lib/constants";
import { runCommand } from "./lib/process";
import { printInfo, printSuccess } from "./lib/ui";

function parseBackend(value: string): Backend {
  if (!BACKENDS.includes(value as Backend)) {
    throw new InvalidArgumentError("Choose one backend: bun, go, or swift.");
  }

  return value as Backend;
}

async function startBackend(backend: Backend) {
  const others = BACKENDS.filter((item) => item !== backend).map((item) => BACKEND_SERVICE[item]);

  if (others.length > 0) {
    printInfo(`Stopping other backend containers so only ${backend} stays active.`);
    runCommand(["docker", "compose", "stop", ...others], { allowFailure: true });
  }

  printInfo(`Starting ${backend} container.`);
  runCommand(["docker", "compose", "up", "-d", BACKEND_SERVICE[backend]]);

  printSuccess(`${backend} is active on http://localhost:${BACKEND_PORT[backend]}.`);
}

const program = new Command()
  .name("start-backend")
  .description("Start one backend container and stop the others.")
  .argument("<backend>", "Backend to start", parseBackend)
  .action(startBackend);

await program.parseAsync(process.argv);
