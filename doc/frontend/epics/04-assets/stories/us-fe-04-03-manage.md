# US-FE-04-03 Create, edit, reorder, and delete assets

| Field | Value |
| --- | --- |
| ID | US-FE-04-03 |
| Epic | E-FE-04 Assets |
| Actor | Authenticated user |
| Priority | Must |
| Status | Ready |

## Story

As a signed-in user, I want to manage the asset catalog, so that names, prices, flags, and order stay current.

## Outcome

The manage screen writes assets and shows an invalid price-source slug without dropping the row.

## Acceptance criteria

1. Given the form, when I save, then I can set name, unit, decimal places, nested asset category, manual toman and USD prices, optional icon, and optional price-source slug.
2. Given the two flags, when I toggle them, then include in profit/loss and include in balance are saved.
3. Given a slug the catalog does not know, when the asset loads, then the form shows it as invalid and still lets me edit the rest.
4. Given I reorder, when I save the order, then the list matches that order.
5. Given I delete, when I confirm, then a 409 explains the asset is in use and the row stays.

## Rules

- Delete confirms first.
- Category picker is asset categories only.

## Data

- Asset form state.

## API

- `POST /assets`, `PATCH /assets/:id`, `PUT /assets/order`, `DELETE /assets/:id`, `GET /price-sources`, `GET /categories?kind=asset`

## Errors

| Code | When |
| --- | --- |
| 400 | Inline field errors |
| 409 | Toast: asset is in use |

## Dependencies

- US-03-01
- US-03-02
- US-FE-09-01

## Test notes

- An unknown slug remains visible as invalid after save.
