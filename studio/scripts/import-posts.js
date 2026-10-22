import fs from "node:fs"
import path from "node:path"
import {getCliClient} from "sanity/cli"
import {dataset, projectId} from "../project.js"

const root = path.resolve(import.meta.dirname, "../..")
const posts = JSON.parse(fs.readFileSync(path.join(root, "content/posts.json"), "utf8"))

function key() {
  return Math.random().toString(36).slice(2, 10)
}

function decode(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function inlineChildren(html) {
  const children = []
  let mark = ""
  let buf = ""
  function flush() {
    if (!buf) return
    children.push({_type: "span", _key: key(), text: decode(buf), marks: mark ? [mark] : []})
    buf = ""
  }
  let i = 0
  while (i < html.length) {
    if (html.startsWith("<strong>", i)) { flush(); mark = "strong"; i += 8; continue }
    if (html.startsWith("</strong>", i)) { flush(); mark = ""; i += 9; continue }
    if (html.startsWith("<em>", i)) { flush(); mark = "em"; i += 4; continue }
    if (html.startsWith("</em>", i)) { flush(); mark = ""; i += 5; continue }
    if (html[i] === "<") {
      const end = html.indexOf(">", i)
      i = end < 0 ? html.length : end + 1
      continue
    }
    buf += html[i]
    i += 1
  }
  flush()
  if (!children.length) children.push({_type: "span", _key: key(), text: "", marks: []})
  return children
}

function htmlToBlocks(html) {
  const blocks = []
  const re = /<(p|h2|h3|li)>([\s\S]*?)<\/\1>/gi
  let match
  while ((match = re.exec(html || ""))) {
    const block = {
      _type: "block",
      _key: key(),
      style: match[1] === "p" || match[1] === "li" ? "normal" : match[1],
      markDefs: [],
      children: inlineChildren(match[2].trim()),
    }
    if (match[1] === "li") {
      block.listItem = "bullet"
      block.level = 1
    }
    blocks.push(block)
  }
  return blocks
}

async function uploadImage(client, imagePath) {
  if (!imagePath) return undefined
  const file = path.join(root, imagePath)
  if (!fs.existsSync(file)) return undefined
  const asset = await client.assets.upload("image", fs.createReadStream(file), {
    filename: path.basename(file),
  })
  return {_type: "image", asset: {_type: "reference", _ref: asset._id}}
}

async function main() {
  if (process.argv.includes("--dry-run")) {
    for (const post of posts) {
      const blocks = htmlToBlocks(post.body_sr)
      console.log(post.slug, blocks.length)
    }
    return
  }
  if (!projectId) throw new Error("Set projectId in studio/project.js and js/sanity.config.js")
  const client = getCliClient({
    projectId,
    dataset,
    apiVersion: "2024-10-21",
    useCdn: false,
  })
  for (const post of posts) {
    const image = await uploadImage(client, post.image)
    await client.createOrReplace({
      _id: "post-" + post.slug,
      _type: "post",
      titleSr: post.title_sr,
      titleEn: post.title_en || "",
      excerptSr: post.excerpt_sr || "",
      excerptEn: post.excerpt_en || "",
      leadSr: post.lead_sr || "",
      slug: {_type: "slug", current: post.slug},
      date: post.date,
      image,
      bodySr: htmlToBlocks(post.body_sr),
    })
    console.log("imported", post.slug)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
