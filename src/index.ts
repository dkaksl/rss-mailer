import fetch from 'node-fetch'
import { existsSync, readFileSync } from 'fs'
import { XMLParser } from 'fast-xml-parser'
import { createHash } from 'crypto'

const FEED_URLS_FILE = 'feeds.txt'

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

const main = async () => {
  console.log('processing rss feeds...')
  const feedUrls = readFeedUrls()
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
      if (item) {
        console.log(`got ${item.length} items`)
        for (const i of item) {
          const { title, description, link } = i
          const itemHash = getHash([title, link])
        }
      }
    }
  }
}

main().then(() => {
  console.log('processing rss feeds done')
})
