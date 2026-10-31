# Goal: Ticker

## The person's description (word for word)

> i am using google Finace app/service right now. Its list feature has bugs or bad user experience.
> I want to create a web app like this by myself, running on ticker.allomos.com
> the main feature is
> - search a stock by keywords or ticker
> - add a ticker to a list, and remove it from a list
> - can create multiple lists
> - ticker details view, just like the other finance apps have.
>   - I just want to use free service api to get a ticker’s price. if no real time refresh, that is also OK with me.

## What the app does, and for whom

A personal stock watchlist web app, a replacement for the list feature of Google Finance, which
the person finds buggy and awkward. It runs at `ticker.allomos.com`. First user: the person
themself.

## Acceptance criteria (as far as known now; to refine in discussion)

1. Searching by company name or keyword (for example "apple") or by ticker (for example "AAPL")
   shows matching stocks, each with its ticker, name and exchange.
2. From search results or a ticker's details page, a ticker can be added to a list in one step,
   choosing which list.
3. A ticker can be removed from a list, and the list updates at once.
4. The person can create several lists, name them, rename them and delete them.
5. Each list shows its tickers with the latest price and the day's change (amount and percent).
6. A ticker's details view shows, as other finance apps do: latest price and day's change, a price
   chart over several ranges (for example 1D, 5D, 1M, 6M, 1Y, 5Y), and key figures (open, high,
   low, previous close, 52-week range, volume, market cap, P/E where available).
7. Prices come from a free data service; delayed prices are acceptable, with the time of the
   price shown. No real-time refresh is required.
8. Lists are kept: they are still there after closing the browser and coming back.
9. The app is reachable at `ticker.allomos.com`.

## Open points for discussion

- Who can use it: only the person (sign-in needed?), or anyone, each with their own lists?
- Where lists are stored: in the browser only, or on a server so they follow the person across
  devices.
- Which free price service is acceptable (some need a free API key and have daily limits).
- Hosting for `ticker.allomos.com` (where `allomos.com`'s DNS is managed).
- Markets: US stocks only, or other exchanges, ETFs, indexes, crypto too.

## Run mode

Run mode: quiet (the person chose it in Allomos; it applies once the build starts).

## Status

This goal task was written first, for discussion: no other areas, iterations or tasks exist
yet, and nothing is built. Planning starts (goal prompt phase 2, step 2) when the person says
to go ahead.
