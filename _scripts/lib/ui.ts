import boxen from "boxen";
import chalk from "chalk";

function repeatIndent(depth: number) {
  return "  ".repeat(depth);
}

export function renderMarkdown(markdown: string) {
  return Bun.markdown.render(
    markdown,
    {
      heading: (children, meta) => {
        const level = meta?.level ?? 1;
        const color =
          level === 1 ? chalk.bold.cyan : level === 2 ? chalk.bold.yellow : chalk.bold.green;
        return `${color(children)}\n\n`;
      },
      paragraph: (children) => `${children.trimEnd()}\n\n`,
      strong: (children) => chalk.bold.white(children),
      emphasis: (children) => chalk.italic(children),
      codespan: (children) => chalk.bgGray.black(` ${children} `),
      code: (children, meta) => {
        const language = meta?.language ? `${chalk.dim(meta.language)}\n` : "";
        const body = children
          .trimEnd()
          .split("\n")
          .map((line) => chalk.dim(`  ${line}`))
          .join("\n");
        return `${language}${body}\n\n`;
      },
      blockquote: (children) =>
        children
          .trimEnd()
          .split("\n")
          .map((line) => chalk.dim.blue(`> ${line}`))
          .join("\n") + "\n\n",
      hr: () => `${chalk.dim("------------------------------------------------------------")}\n\n`,
      listItem: (children, meta) => {
        const depth = meta?.depth ?? 0;
        const ordered = meta?.ordered ?? false;
        const index = meta?.index ?? 0;
        const start = meta?.start ?? 1;
        const marker = ordered ? `${start + index}.` : "•";
        return `${repeatIndent(depth)}${chalk.magenta(marker)} ${children.trimEnd()}\n`;
      },
      list: (children) => `${children}\n`,
      link: (children, meta) => {
        const label = children || meta?.href || "";
        const suffix = meta?.href && meta.href !== label ? ` ${chalk.dim(`(${meta.href})`)}` : "";
        return `${chalk.blue.underline(label)}${suffix}`;
      },
      text: (children) => children
    },
    {
      autolinks: true
    }
  );
}

export function printMarkdown(markdown: string) {
  console.log(
    boxen(renderMarkdown(markdown).trimEnd(), {
      padding: { top: 0, right: 1, bottom: 0, left: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    })
  );
}

export function printSuccess(message: string) {
  console.log(`${chalk.green.bold("Done")} ${message}`);
}

export function printInfo(message: string) {
  console.log(`${chalk.cyan.bold("Info")} ${message}`);
}

export function printWarning(message: string) {
  console.log(`${chalk.yellow.bold("Warning")} ${message}`);
}

export function fail(message: string): never {
  console.error(
    boxen(chalk.red.bold(message), {
      padding: { top: 0, right: 1, bottom: 0, left: 1 },
      borderStyle: "round",
      borderColor: "red"
    })
  );
  process.exit(1);
}
