import { ROOT_DIR } from "./constants";

interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  allowFailure?: boolean;
}

function buildEnv(extraEnv?: Record<string, string>) {
  return {
    ...process.env,
    ...extraEnv
  };
}

export function runCommand(command: string[], options: CommandOptions = {}) {
  const proc = Bun.spawnSync(command, {
    cwd: options.cwd ?? ROOT_DIR,
    env: buildEnv(options.env),
    stdout: "inherit",
    stderr: "inherit"
  });

  if (proc.exitCode !== 0 && !options.allowFailure) {
    throw new Error(`Command failed: ${command.join(" ")}`);
  }

  return proc;
}

export function captureCommand(command: string[], options: CommandOptions = {}) {
  const proc = Bun.spawnSync(command, {
    cwd: options.cwd ?? ROOT_DIR,
    env: buildEnv(options.env),
    stdout: "pipe",
    stderr: "pipe"
  });

  if (proc.exitCode !== 0 && !options.allowFailure) {
    const errorText = new TextDecoder().decode(proc.stderr).trim();
    throw new Error(errorText || `Command failed: ${command.join(" ")}`);
  }

  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr)
  };
}
