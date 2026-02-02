# Game Configuration Schema

This document describes the structure of the JSON configuration files used to define games and scoring criteria in the Coyote Collator application.

## Directory Structure

*   `config/games/*.json`: Definitions for individual games (Patrol, Troop, or Exhibition).
*   `config/common/*.json`: Shared field definitions (e.g., headers or footers) included by multiple games.

## Game Definition (`config/games/*.json`)

Each file represents a single game/activity.

```json
{
  "id": "p1",
  "name": "Boiling the Ocean",
  "type": "patrol",
  "includes": ["../common/patrol_header.json"],
  "fields": [
    ... // Array of Field Definitions
  ],
  "appends": ["../common/patrol_footer.json"]
}
```

### Root Attributes

| Attribute | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier. Format convention: `p#` for Patrol, `t#` for Troop, `e#` for Exhibition. |
| `name` | `string` | Display name of the game. |
| `type` | `string` | Category of the game. Allowed values: `"patrol"`, `"troop"`, `"exhibition"`. |
| `includes` | `array` | Optional. List of relative paths to JSON files containing fields to be inserted **above** the local `fields`. |
| `fields` | `array` | List of scoring fields specific to this game (the "meat" of the sandwich). |
| `appends` | `array` | Optional. List of relative paths to JSON files containing fields to be inserted **below** the local `fields`. |

---

## Field Definition

Fields define a single input on the scoring form. These are used in the `fields` array or inside included/append files.

```json
{
    "id": "time_to_boil",
    "label": "Time to Boil",
    "type": "time_mm_ss",
    "kind": "metric",
    "audience": "judge",
    "sortOrder": 10
}
```

### Field Attributes

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Unique key for the score payload. Must be unique within the game. |
| `label` | `string` | Yes | Display text for the label. |
| `type` | `string` | Yes | Input type (see Supported Field Types below). |
| `min` | `number` | No | Minimum value (for `number` or `range` types). |
| `max` | `number` | No | Maximum value (for `number` or `range` types). |
| `defaultValue` | `any` | No | Initial value. |
| `placeholder` | `string` | No | Helper text inside the input. |
| `options` | `string[]`| No | Array of strings for `select` type. |
| `audience` | `string` | No | Controls visibility. `"judge"` (default): visible to field judges. `"admin"`: hidden from judges, visible/editable only by admin. |
| `kind` | `string` | No | Controls summation behavior. `"points"` (default): value is added to "Total Score". `"metric"`: value is raw data (e.g. time, counts) and not added to total. |
| `sortOrder` | `number` | No | Controls the display order of fields. Lower numbers appear first. Defaults to 900. |

### Supported Field Types

| Type | Description |
| :--- | :--- |
| `number` | Standard numeric input (integer or float). Renders with numeric keypad on mobile. |
| `text` | Single-line text input. |
| `textarea` | Multi-line text input. |
| `select` | Dropdown menu (requires `options` array). |
| `range` | Slider control (requires `min` and `max`). |
| `time_mm_ss` | Special stopwatch input. Renders "Start" button and Minutes:Seconds fields. |
| `boolean` | **Deprecated**. Use `number` or `select` preferred. Renders as a switch. |

---

## Composition Strategy ("The Sandwich")

The server merges fields in a specific order to create the final form layout:

1.  **Header (`includes`):** Shared fields that appear at the top of many forms (e.g. Patrol Flag, Yell).
2.  **Meat (`fields`):** Station-specific fields unique to that game.
3.  **Footer (`appends`):** Shared fields that appear at the bottom (e.g. Penalties, Judge Notes).

Example of a shared field file (e.g. `config/common/patrol_header.json`):

```json
[
  {
    "id": "patrol_spirit",
    "label": "Patrol Spirit",
    "type": "range",
    "min": 0,
    "max": 5,
    "sortOrder": 1
  }
]
```

These common files must contain an **array** of Field objects.
