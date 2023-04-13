import fetch from 'node-fetch'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { XMLParser } from 'fast-xml-parser'
import { createHash } from 'crypto'

const FEED_URLS_FILE = 'feeds.txt'
const OUTPUT_DIR = 'output'
const PROCESSED_FILE = `${OUTPUT_DIR}/processed.json`

const parser = new XMLParser()

const readFeedUrls = () => {
  if (!existsSync(FEED_URLS_FILE)) {
    console.warn(`file not found: ${FEED_URLS_FILE}`)
    return []
  }
  return readFileSync(FEED_URLS_FILE)
    .toString()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^https:\/\//g.test(line))
}

const fetchFeed = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(`unable to fetch feed ${url}; got status: ${response.status}`)
    return undefined
  }
  return await response.text()
}

const parseItem = (item: any) => {
  return {
    title: item.title,
    description: item.description,
    link: item.link
  }
}

const parseItems = (items: any) => {
  if (!Array.isArray(items)) {
    return []
  }
  return items.map((item) => parseItem(item))
}

const parseXml = (parser: XMLParser, xml: string) => {
  try {
    const parsed = parser.parse(xml)
    const rss = parsed?.rss
    const channel = rss?.channel
    const title = channel?.title
    const description = channel?.description
    const link = channel?.link
    const item = channel?.item

    return {
      rss: {
        channel: {
          title,
          description,
          link,
          item: parseItems(item)
        }
      }
    }
  } catch (err) {
    console.log(`xml parse failed; ${err}`)
    return undefined
  }
}

const getHash = (input: string[]) => {
  return createHash('md5').update(input.join('|')).digest('hex')
}

const getProcessedFeeds = () => {
  if (existsSync(PROCESSED_FILE)) {
    console.log('found processed file')
    return JSON.parse(readFileSync(PROCESSED_FILE).toString())
  }
  return {}
}

const main = async () => {
  console.log('processing rss feeds...')
  const feedUrls = readFeedUrls()
  const processed = getProcessedFeeds()
  for (const url of feedUrls) {
    const feed = await fetchFeed(url)
    if (!feed) {
      continue
    }

    const parsedFeed = parseXml(parser, feed)
    if (parsedFeed) {
      const { title, description, link, item } = parsedFeed.rss.channel
      console.log(`got feed: ${title}, ${description}, ${link}`)
      const feedHash = getHash([title, link])
      const processedFeed = processed[feedHash]
      if (!processedFeed) {
        processed[feedHash] = []
      }

      if (item) {
        console.log(`got ${item.length} items`)
        for (const i of item) {
          const { title, description, link } = i
          const itemHash = getHash([title, link])
          if (!processed[feedHash].find((hash: string) => hash === itemHash)) {
            // TODO: new feed entry -> send email
            processed[feedHash].push(itemHash)
          }
        }
      }
    }
  }
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  writeFileSync(PROCESSED_FILE, JSON.stringify(processed))
}

main().then(() => {
  console.log('processing rss feeds done')
})
