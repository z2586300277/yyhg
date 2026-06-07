import { setIndexDB } from './indexDb'

let modelListPromise = null

export function mapSceneModelUrls(sceneParams, modelList = [], generatedBlobUrls = []) {
  if (!Array.isArray(sceneParams?.modelCores) || !sceneParams.modelCores.length) return sceneParams

  sceneParams.modelCores = sceneParams.modelCores.filter((core) => {
    const dbNameUrl = core?.modelInfo?.threeEditorDBNameUrl
    if (!dbNameUrl) return true

    const [, name = ''] = dbNameUrl.split(':')
    const item = modelList.find((v) => v.name === name)
    if (!item?.blob) return false

    const url = URL.createObjectURL(item.blob)
    generatedBlobUrls.push(url)
    core.modelInfo.url = url
    return true
  })

  return sceneParams
}

export async function loadIndexDbModelList() {
  if (!modelListPromise) {
    modelListPromise = setIndexDB()
      .then((dbApi) => dbApi.getAllRequest())
      .then(({ data = [] }) => data)
      .catch((error) => {
        modelListPromise = null
        throw error
      })
  }

  return modelListPromise
}

