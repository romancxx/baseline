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

Code keeps `instrument` and `position` where it mirrors the API; copy and new domain names use the terms above.
