// Copies the pdf.js worker from the installed pdfjs-dist into public/ so it is
// served same-origin. A cross-origin module worker (e.g. from a CDN) cannot be
// instantiated by browsers, which makes pdf.js fall back to a broken "fake
// worker" — copying the exact installed build keeps the worker version-locked.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const dest = path.join(root, 'public', 'pdf.worker.min.mjs')

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.cpSync(src, dest)
console.log(`Copied pdf.js worker -> ${path.relative(root, dest)}`)
