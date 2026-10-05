# Chain menu data

One JSON file per restaurant chain. The app uses these to turn an order like
"Whataburger sweet and spicy bacon burger, no bun, extra patty" into macros:
the chain and item are matched by name, the item's **build** (its components)
is handed to the on-device model, the model adjusts counts for the
modifications, and the totals come from the chain's own per-component numbers.

Every number must come from the chain's published nutrition information
(their website or nutrition PDF), never from memory or third-party sites.
Record the source URL on the file.

## File shape

```json
{
  "chain": "Whataburger",
  "aliases": ["whataburger", "what-a-burger"],
  "source": "https://whataburger.com/nutrition",
  "retrieved": "2026-10-05",
  "components": {
    "beef patty": { "unit": "each", "protein": 16, "fat": 16, "carbs": 0, "fiber": 0, "calories": 210 },
    "american cheese": { "unit": "slice", "protein": 3, "fat": 4, "carbs": 1, "fiber": 0, "calories": 50 }
  },
  "items": [
    {
      "name": "Sweet & Spicy Bacon Burger",
      "aliases": ["sweet and spicy bacon burger"],
      "macros": { "protein": 60, "fat": 62, "carbs": 69, "fiber": 3, "calories": 1080 },
      "build": [
        { "component": "beef patty", "count": 2 },
        { "component": "american cheese", "count": 1 }
      ]
    }
  ]
}
```

- `components`: ingredients the chain uses across items, with macros for ONE
  `unit` (each, slice, strip, ounce, cup, tablespoon, piece, scoop). Only
  include a component when its numbers are published or can be derived by
  subtraction between two published items (e.g. Double minus Single = one
  patty + one cheese); say which in `"derived"`.
- `items[].macros`: the item's published totals, as sold.
- `items[].build`: the components as sold, when the item is modifiable
  (burgers, sandwiches, bowls, burritos, salads). Omit `build` for items that
  are eaten whole (fries, nuggets, drinks, pizza slices, desserts). A build
  does not have to reproduce the published totals exactly; a validator flags
  a mismatch over 15%.
- `aliases`: lowercase names people actually type, including common
  misspellings and the chain's shorthand ("dbl", "jr").
- Grams for protein, fat, carbs, fiber; calories as published. All numbers
  are for one item or one component unit.
