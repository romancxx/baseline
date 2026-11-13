# StockNews

News about the securities a user holds, read against their portfolio.
This glossary is shared by the API and the web app.

## Access

**User**:
A person who signs in with an email and a password, and owns a portfolio.
_Avoid_: account, member, customer

**Session**:
The time a user stays signed in, from signing in to signing out or to its expiry.
_Avoid_: login, connection

**Sign in**:
Starting a session with an email and a password.
_Avoid_: log in, login (except in the API's endpoint names)

**Sign out**:
Ending a session.
_Avoid_: log out, logout (except in the API's endpoint names)

**Create account**:
Registering a new user, then signing them in; the user-facing name for registration.
_Avoid_: sign up, register (except in the API's endpoint names)

## Portfolio

**Security**:
What a user holds: one share class of a company or fund, a stock or an ETF.
The API calls the listings of one security a _security group_.
_Avoid_: asset, ticker

**Listing**:
One exchange's quote of a security, in that exchange's currency; a security can have several.
The API calls it an _instrument_.
_Avoid_: ticker, symbol (the symbol is the listing's code, not the listing)

**Holding**:
A listing in the portfolio, with or without a position.
The API calls every holding a _position_, even one without a quantity.
_Avoid_: line, asset

**Position**:
A holding's quantity and average price.
A holding without a quantity has no position: the user follows its price only.
_Avoid_: lot, trade

**Followed security**:
A security held by at least one user, so that its prices and news are collected.
_Avoid_: watched, tracked, watchlist

## Valuation

**Latest close**:
A listing's most recent stored closing price; never a live price.
_Avoid_: current price, last price, quote

**Base currency**:
The one currency the portfolio's totals are shown in.
_Avoid_: home currency, reporting currency

**Value**:
What a position is worth at its latest close: its quantity times that close.
_Avoid_: market value, worth

**Cost**:
What a position was bought for: its quantity times its average price.
_Avoid_: book value, invested amount

**Unrealised gain**:
A position's value minus its cost, positive or negative.
_Avoid_: P&L, profit, return, performance

**Weight**:
A holding's share of the portfolio's total value, in percent.
_Avoid_: allocation, exposure

**Overview**:
The portfolio's holdings with their value, unrealised gain and weight, and the portfolio's totals.
_Avoid_: dashboard, summary

## News

**Article**:
A news item about a security, as its publisher put it out: a headline, the publisher, the publication time and a link.
StockNews keeps the headline only, never the article's text.
_Avoid_: story, post, news item

**Headline**:
An article's title, the only part of it StockNews reads.
_Avoid_: title (except in the API's field names), teaser

**Publisher**:
The outlet that published an article, such as Reuters.
_Avoid_: source, outlet, provider

**News source**:
Where StockNews collects articles from, such as Google News.
_Avoid_: feed, provider, publisher

**Brief**:
A few sentences, written by a model, on what was reported about one security over the last few days, citing the headlines it was written from.
It describes the news; it never advises.
_Avoid_: summary, digest, recap, analysis

**Tone**:
How the reported facts bear on the company itself, not on its share price: positive, negative, neutral or mixed.
_Avoid_: sentiment, bullish, bearish

**Citation**:
An article a brief names as one it was written from.
_Avoid_: reference, source

**Provenance**:
The line under a brief that says how many articles it cites, which days their headlines span, and when it was written.
_Avoid_: footnote, metadata

Code keeps `instrument`, `position` and `security group` where it mirrors the API; copy and new domain names use the terms above.
