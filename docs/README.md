## 🛠 The Game File Structure

Each game file (e.g., `game_05.json`) must follow this structure:

```json
{
  "id": "game_05_fire",       // UNIQUE identifier (no spaces)
  "name": "Game 5: Fire Building", // Human-readable title
  "type": "patrol",           // "patrol" (adds common scoring) or "troop" (standalone)
  "fields": [                 // The list of scoring questions
    {
      "id": "matches_count",
      "label": "Matches Used",
      "type": "number",
      "min": 0,
      "max": 20
    }
  ]
}
```

⚠️ Critical Rules
Unique IDs: The id of the game (game_05_fire) and the fields (matches_count) must be unique within that file.

No Changing IDs: Once the event starts, NEVER change an ID. If you change matches_count to matches_used, old scores will break. You can change the label anytime.

🎛 Available Input Types
These are the "Lego blocks" you can use to build your scoring form.

1. boolean (Checkbox)
Used for Pass/Fail or Yes/No questions.

JSON

{
  "id": "ten_essentials",
  "label": "10 Essentials Present?",
  "type": "boolean",
  "defaultValue": true
}
2. number (Integer Input)
Used for counts (matches, knots tied, deductions).

JSON

{
  "id": "knots_tied",
  "label": "Knots Successfully Tied",
  "type": "number",
  "min": 0,
  "max": 8
}
3. range (Slider)
Used for subjective scoring (Spirit, Teamwork).

JSON

{
  "id": "teamwork",
  "label": "Teamwork Score (1-10)",
  "type": "range",
  "min": 1,
  "max": 10,
  "defaultValue": 5
}
4. timed (Stopwatch)
A special input for timed events. The user enters Minutes and Seconds.

Stored As: A string "MM:SS".

Required: Add "required": true if they must enter a time.

JSON

{
  "id": "boil_time",
  "label": "Time to Boil",
  "type": "timed"
}
5. select (Dropdown)
Used when there are specific text options.

JSON

{
  "id": "fire_type",
  "label": "Bonus Points Level",
  "type": "select",
  "options": [
    "None",
    "Smoke Only",
    "Ember Created",
    "Ignition (Flame)"
  ]
}
🧩 The "Common Scoring" (common.json)
This file defines fields that are automatically injected into every game where "type": "patrol".

Do not edit this during the event.

It typically contains: Patrol Flag, Patrol Yell, Spirit, and Un-Scout-like Conduct.

❓ FAQ for Game Designers
Q: Can I have a negative score? A: Yes. Use type: "number" with a min value (e.g., -10). Or, use a positive number field labeled "Penalty Points" and handle the subtraction in your spreadsheet later.

Q: How do I delete a game? A: Just delete the .json file from the config/games/ folder and restart the server.

Q: I made a typo in the JSON! A: The server is smart. If one file is broken, it will skip it and log an error to the console, but the other games will still load.


***

