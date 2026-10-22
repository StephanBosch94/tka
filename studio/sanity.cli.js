import {defineCliConfig} from 'sanity/cli'
import {dataset, projectId, studioHost} from './project'

export default defineCliConfig({
  api: {
    projectId: projectId || 'tka-pending',
    dataset,
  },
  studioHost,
  deployment: {
    appId: 'thc70qncfdx0mh8nzy7c0ahp',
  },
})
