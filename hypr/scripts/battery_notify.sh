#!/bin/bash

# Paths for battery information
BATTERY_PATH="/sys/class/power_supply/BAT0"
CAPACITY_FILE="$BATTERY_PATH/capacity"
STATUS_FILE="$BATTERY_PATH/status"

# Path to your custom icon
icon_path="/home/erick/.config/hypr/assets/icons/mdi--battery-outline.png"

# Path to your custom sound
sound_path="/home/erick/.config/hypr/assets/sounds/waterdrop.wav"

# Function to send notification and play sound
send_notification() {
  notify-send -i "$icon_path" "Battery Alert" "$1"
  paplay "$sound_path"
}

# Check if battery files exist
if [ ! -f "$CAPACITY_FILE" ] || [ ! -f "$STATUS_FILE" ]; then
  send_notification "Error: Cannot read battery information"
  exit 1
fi

# Get battery percentage
battery_percentage=$(cat "$CAPACITY_FILE")

# Get charging status
charging_status=$(cat "$STATUS_FILE")

# Check battery level and send notifications
if [ "$charging_status" != "Charging" ]; then
  if [ "$battery_percentage" -le 20 ]; then
    send_notification "Battery level is critically low: $battery_percentage%"
  elif [ "$battery_percentage" -le 40 ]; then
    send_notification "Battery level is getting low: $battery_percentage%"
  fi
else
  if [ "$battery_percentage" -ge 80 ]; then
    send_notification "Battery is almost full: $battery_percentage%"
  fi
fi
