import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, "assets", "source-images");
const outputRoot = path.join(projectRoot, "public", "media");
const manifestPath = path.join(outputRoot, "image-manifest.json");
const sizes = [768, 1280, 1920];
const quality = 78;

const collections = [
  { name: "home_slides", matches: /^slide_\d+\.webp$/i },
  { name: "gallery", matches: /^gallery_\d+\.webp$/i },
  { name: "room_images", matches: /\.webp$/i },
];

function assertGeneratedOutputPath() {
  const relativeOutput = path.relative(projectRoot, outputRoot);
  if (relativeOutput !== path.join("public", "media")) {
    throw new Error(`Refusing to replace unexpected output directory: ${outputRoot}`);
  }
}

function publicUrl(collection, fileName) {
  return `/media/${collection}/${fileName}`;
}

async function optimizeCollection({ name, matches }) {
  const sourceDirectory = path.join(sourceRoot, name);
  const outputDirectory = path.join(outputRoot, name);
  const fileNames = (await readdir(sourceDirectory))
    .filter((fileName) => matches.test(fileName))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  if (!fileNames.length) {
    throw new Error(`No source images found in ${sourceDirectory}`);
  }

  await mkdir(outputDirectory, { recursive: true });
  const entries = {};

  for (const fileName of fileNames) {
    const sourcePath = path.join(sourceDirectory, fileName);
    const sourceBuffer = await readFile(sourcePath);
    const sourceMetadata = await sharp(sourceBuffer).metadata();
    const extension = path.extname(fileName);
    const stem = path.basename(fileName, extension);
    const variants = [];

    for (const size of sizes) {
      const outputName = `${stem}-${size}.webp`;
      const outputPath = path.join(outputDirectory, outputName);
      await sharp(sourceBuffer)
        .rotate()
        .resize({
          width: size,
          height: size,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality,
          effort: 4,
          smartSubsample: true,
        })
        .toFile(outputPath);

      const [metadata, fileStats] = await Promise.all([
        sharp(outputPath).metadata(),
        stat(outputPath),
      ]);

      variants.push({
        url: publicUrl(name, outputName),
        width: metadata.width,
        height: metadata.height,
        bytes: fileStats.size,
      });
    }

    entries[`${name}/${fileName}`] = {
      sourceWidth: sourceMetadata.width,
      sourceHeight: sourceMetadata.height,
      variants,
    };
  }

  return entries;
}

assertGeneratedOutputPath();
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const manifest = {
  generatedAt: new Date().toISOString(),
  format: "webp",
  quality,
  sizes,
  images: {},
};

for (const collection of collections) {
  Object.assign(manifest.images, await optimizeCollection(collection));
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const sourceBytes = Object.values(manifest.images)
  .reduce((total, image) => total + image.variants[image.variants.length - 1].bytes, 0);
console.log(
  `Generated ${Object.keys(manifest.images).length * sizes.length} responsive images `
  + `(${(sourceBytes / 1024 / 1024).toFixed(2)} MB across largest variants).`,
);
