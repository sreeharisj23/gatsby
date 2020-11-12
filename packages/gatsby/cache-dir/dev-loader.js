import { BaseLoader, PageResourceStatus } from "./loader"
import { findPath } from "./find-path"
import tellServerWantToVisitPage from "./tell-server-want-to-visit-page.ts"

class DevLoader extends BaseLoader {
  constructor(lazyRequires, matchPaths) {
    // One of the tests doesn't set a path.
    const loadComponent = chunkName => {
      if (process.env.NODE_ENV !== `test`) {
        delete require.cache[
          require.resolve(`$virtual/lazy-client-sync-requires`)
        ]
        lazyRequires = require(`$virtual/lazy-client-sync-requires`)
      }
      if (lazyRequires.lazyComponents[chunkName]) {
        return Promise.resolve(lazyRequires.lazyComponents[chunkName])
      } else {
        return new Promise(resolve => {
          // Tell the server the user wants to visit this page
          // to trigger it compiling the page component's code.
          tellServerWantToVisitPage(chunkName)

          const checkForUpdates = () => {
            if (process.env.NODE_ENV !== `test`) {
              delete require.cache[
                require.resolve(`$virtual/lazy-client-sync-requires`)
              ]
            }
            const lazyRequires = require(`$virtual/lazy-client-sync-requires`)
            if (lazyRequires.lazyComponents[chunkName]) {
              resolve(lazyRequires.lazyComponents[chunkName])
            }

            setTimeout(checkForUpdates, 100)
          }
          setTimeout(checkForUpdates, 100)
        })
      }
    }
    super(loadComponent, matchPaths)
  }

  loadPage(pagePath) {
    const realPath = findPath(pagePath)
    return super.loadPage(realPath).then(result =>
      require(`./socketIo`)
        .getPageData(realPath)
        .then(() => result)
    )
  }

  loadPageDataJson(rawPath) {
    return super.loadPageDataJson(rawPath).then(data => {
      // when we can't find a proper 404.html we fallback to dev-404-page
      // we need to make sure to mark it as not found.
      if (
        data.status === PageResourceStatus.Error &&
        rawPath !== `/dev-404-page/`
      ) {
        console.error(
          `404 page could not be found. Checkout https://www.gatsbyjs.org/docs/add-404-page/`
        )
        return this.loadPageDataJson(`/dev-404-page/`).then(result =>
          Object.assign({}, data, result)
        )
      }

      return data
    })
  }

  doPrefetch(pagePath) {
    return Promise.resolve(require(`./socketIo`).getPageData(pagePath))
  }
}

export default DevLoader
