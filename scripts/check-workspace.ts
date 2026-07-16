import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

const root = resolve(import.meta.dir, "..");
const errors: string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(resolve(root, path), "utf8"));
    if (!isRecord(value)) throw new TypeError("root value must be a JSON object");
    return value;
  } catch (error) {
    errors.push(
      `${path}: ${error instanceof Error ? error.message : "could not read JSON"}`,
    );
  }
}

function expect(condition: boolean, message: string) {
  if (!condition) errors.push(message);
}

function isDirectory(path: string) {
  try {
    return statSync(resolve(root, path)).isDirectory();
  } catch {
    return false;
  }
}

const packageJson = readJson("package.json");
const tsconfig = readJson("tsconfig.json");
const turbo = readJson("turbo.json");

for (const directory of ["api", "web", "mobile", "packages", "scripts"]) {
  expect(isDirectory(directory), `${directory}/: required root directory is missing`);
}

const workspacePaths = ["api", "web", "mobile"];
if (isDirectory("packages")) {
  for (const entry of readdirSync(resolve(root, "packages"), { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      existsSync(resolve(root, "packages", entry.name, "package.json"))
    ) {
      workspacePaths.push(`packages/${entry.name}`);
    }
  }
}

for (const workspacePath of workspacePaths) {
  const manifest = readJson(`${workspacePath}/package.json`);
  expect(
    typeof manifest?.name === "string" && manifest.name.length > 0,
    `${workspacePath}/package.json: workspace name is required`,
  );
}

const requiredExecutableScripts = ["scripts/dev-mobile.sh", "scripts/dev-all.sh"];
for (const script of requiredExecutableScripts) {
  try {
    expect(
      statSync(resolve(root, script)).isFile() && (statSync(resolve(root, script)).mode & 0o111) !== 0,
      `${script}: required executable script is missing or not executable`,
    );
  } catch {
    errors.push(`${script}: required executable script is missing or not executable`);
  }
}

if (packageJson) {
  expect(
    packageJson.packageManager === "bun@1.3.14",
    "package.json: packageManager must be bun@1.3.14",
  );

  const engines = packageJson.engines as Record<string, unknown> | undefined;
  expect(engines?.node === ">=22.13", "package.json: Node engine must be >=22.13");
  expect(engines?.bun === ">=1.3.14", "package.json: Bun engine must be >=1.3.14");

  const expectedWorkspaces = ["api", "web", "mobile", "packages/*"];
  expect(
    JSON.stringify(packageJson.workspaces) === JSON.stringify(expectedWorkspaces),
    `package.json: workspaces must be exactly ${expectedWorkspaces.join(", ")}`,
  );

  const devDependencies = packageJson.devDependencies as
    | Record<string, unknown>
    | undefined;
  expect(
    typeof devDependencies?.turbo === "string",
    "package.json: turbo must be a root devDependency",
  );

  const scripts = packageJson.scripts as Record<string, unknown> | undefined;
  const expectedScripts = {
    dev: "./scripts/dev-stack.sh",
    "dev:web": "./scripts/dev-web.sh",
    "dev:api": "./scripts/dev-api-docker.sh",
    "dev:mobile": "./scripts/dev-mobile.sh",
    "dev:all": "./scripts/dev-all.sh",
    turbo: "bun node_modules/turbo/bin/turbo",
    lint: "bun run turbo run lint",
    typecheck: "bun run turbo run typecheck",
    test: "bun run turbo run test --filter=@imediasave/web && bun run test:mobile",
    "test:mobile": "bun run --cwd mobile test",
    check: "bun run check:workspace && bun run lint && bun run typecheck && bun run test",
    "check:workspace": "bun scripts/check-workspace.ts",
    build: "bun run turbo run build --filter=@imediasave/web",
    "build:all": "bun run turbo run build",
    "mobile:doctor": "bun run --cwd mobile doctor",
  };
  for (const [script, command] of Object.entries(expectedScripts)) {
    expect(
      scripts?.[script] === command,
      `package.json: ${script} must be exactly ${JSON.stringify(command)}`,
    );
  }

  const presenceOnlyScripts = [
    "doctor",
    "setup",
    "dev:api:local",
    "gcp:setup",
    "gcp:docker-auth",
    "gcp:secrets",
    "gcp:github-oidc",
    "push:api",
    "push:web",
    "push:images",
    "deploy:api",
    "deploy:web",
    "deploy:sync",
    "deploy:run",
    "build:web",
    "build:api",
    "preview:web",
    "compose:up",
    "compose:down",
    "compose:logs",
  ];
  for (const script of presenceOnlyScripts) {
    expect(
      typeof scripts?.[script] === "string",
      `package.json: missing existing script ${script}`,
    );
  }
}

if (tsconfig) {
  const references = tsconfig.references as Array<{ path?: string }> | undefined;
  const paths = references?.map(({ path }) => path) ?? [];
  expect(
    JSON.stringify(paths) === JSON.stringify(["./web", "./mobile"]),
    "tsconfig.json: references must be exactly ./web and ./mobile",
  );
}

if (turbo) {
  const expectedTasks = {
    build: {
      dependsOn: ["^build"],
      outputs: [".output/**", "dist/**"],
    },
    dev: {
      cache: false,
      persistent: true,
    },
    lint: { cache: false },
    typecheck: { cache: false },
    test: { cache: false },
  };
  expect(
    isDeepStrictEqual(turbo.tasks, expectedTasks),
    "turbo.json: tasks must exactly match the required task graph",
  );
}

const bunfigPath = resolve(root, "bunfig.toml");
if (existsSync(bunfigPath)) {
  try {
    const bunfig = Bun.TOML.parse(readFileSync(bunfigPath, "utf8"));
    const install = isRecord(bunfig.install) ? bunfig.install : undefined;
    expect(install?.linker === "hoisted", 'bunfig.toml: [install] linker must be "hoisted"');
  } catch (error) {
    errors.push(
      `bunfig.toml: ${error instanceof Error ? error.message : "could not parse TOML"}`,
    );
  }
} else {
  errors.push("bunfig.toml: file is required");
}

const lockPath = resolve(root, "bun.lock");
expect(existsSync(lockPath), "bun.lock: required lockfile is missing");
if (existsSync(lockPath)) {
  try {
    const lock = Bun.JSONC.parse(readFileSync(lockPath, "utf8"));
    const workspaces = isRecord(lock.workspaces) ? lock.workspaces : undefined;
    const rootWorkspace = isRecord(workspaces?.[""]) ? workspaces[""] : undefined;
    const mobileWorkspace = isRecord(workspaces?.mobile) ? workspaces.mobile : undefined;
    const rootDevDependencies = isRecord(rootWorkspace?.devDependencies)
      ? rootWorkspace.devDependencies
      : undefined;
    expect(
      rootWorkspace?.name === "imediasave-workspace",
      "bun.lock: root workspace metadata is stale",
    );
    expect(
      rootDevDependencies?.turbo === "^2.9.15",
      "bun.lock: Turbo dependency is stale",
    );
    expect(
      mobileWorkspace?.name === "@imediasave/mobile",
      "bun.lock: mobile workspace metadata is missing",
    );
  } catch (error) {
    errors.push(`bun.lock: ${error instanceof Error ? error.message : "could not parse lockfile"}`);
  }
}
for (const obsoleteFile of ["pnpm-workspace.yaml", "pnpm-lock.yaml"]) {
  expect(!existsSync(resolve(root, obsoleteFile)), `${obsoleteFile}: obsolete file must be removed`);
}

const activeToolingFiles = [
  "Dockerfile",
  "web/Dockerfile",
  "package.json",
  "Makefile",
  "docker-compose.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy.yml",
  ...readdirSync(resolve(root, "scripts"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== "check-workspace.ts")
    .map((entry) => `scripts/${entry.name}`),
];
for (const file of activeToolingFiles) {
  if (!existsSync(resolve(root, file))) continue;
  expect(
    !/\bpnpm\b|pnpm-lock|pnpm-workspace/i.test(readFileSync(resolve(root, file), "utf8")),
    `${file}: active tooling must not reference pnpm`,
  );
}

const webPackageJson = readJson("web/package.json");
const webScripts = webPackageJson?.scripts;
expect(
  isRecord(webScripts) && webScripts.test === "bun test",
  'web/package.json: test script must be exactly "bun test"',
);

const mobilePackageJson = readJson("mobile/package.json");
expect(
  mobilePackageJson?.main === "expo-router/entry",
  'mobile/package.json: main must be exactly "expo-router/entry"',
);
const mobileScripts = mobilePackageJson?.scripts;
expect(
  isRecord(mobileScripts) &&
    mobileScripts.test === "node ../node_modules/jest/bin/jest.js --runInBand",
  'mobile/package.json: test script must invoke Jest with Node in runInBand mode',
);

if (errors.length > 0) {
  console.error("workspace configuration is invalid:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("workspace configuration is valid");
