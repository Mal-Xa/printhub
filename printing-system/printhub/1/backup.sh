#!/bin/bash

set -e

CLIENT_DIR="client"
SERVER_DIR="server"
DEST_PATH="/home/sora/Project/phbck"

# Check destination exists
if [ ! -d "$DEST_PATH" ]; then
    echo "❌ Backup folder not found: $DEST_PATH"
    exit 1
fi

# Get next number
LAST_NUM=$(ls "$DEST_PATH" 2>/dev/null | grep -o '^[0-9]\+' | sort -n | tail -1)

if [ -z "$LAST_NUM" ]; then
    NEXT_NUM=1
else
    NEXT_NUM=$((LAST_NUM + 1))
fi

echo "📌 Next backup number: $NEXT_NUM"

# Ask for description
read -p "📝 Enter description: " DESC

# Clean spaces (optional but safer)
DESC_CLEAN=$(echo "$DESC" | tr ' ' '_')

FOLDER_NAME="${NEXT_NUM}(${DESC_CLEAN})"
FINAL_PATH="$DEST_PATH/$FOLDER_NAME"

# Create zip
ZIP_NAME="project_${NEXT_NUM}.zip"

echo "📦 Creating archive..."

zip -r "$ZIP_NAME" "$CLIENT_DIR" "$SERVER_DIR" \
  -x "$CLIENT_DIR/android/*" \
  -x "$CLIENT_DIR/dist/*" \
  -x "$CLIENT_DIR/node_modules/*" \
  -x "$SERVER_DIR/node_modules/*"

# Create directory and move
mkdir -p "$FINAL_PATH"
mv "$ZIP_NAME" "$FINAL_PATH/"

echo "🚀 Backup complete!"
echo "📁 Folder: $FINAL_PATH"
echo "📦 File: $ZIP_NAME"
