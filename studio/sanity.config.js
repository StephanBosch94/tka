import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {dataset, projectId} from './project'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'tka',
  title: 'TKA',
  projectId: projectId || 'tka-pending',
  dataset,
  plugins: [structureTool()],
  schema: {types: schemaTypes},
})
