import os
import shutil
import json
import subprocess
import re
import sys

if __name__ == "__main__":
    # Load configuration from JSON
    with open(".github/settings/eagle-utils-config.json") as f:
        config = json.load(f)
    
    src = config["src"]
    branch = config["branch"]

    # Create temporary directory matching workflow structure
    temp_dir = os.path.join(os.getcwd(), ".utils-tmp")

    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)

    os.makedirs(temp_dir, exist_ok=True)
    
    # Clone repository with config settings
    subprocess.run([
        "git", "clone", "--depth", "1","--branch", branch,
        src, temp_dir
    ], check=True)
    
    utils_list = [file for file in os.listdir(temp_dir) if os.path.isfile(os.path.join(temp_dir, file)) and file.endswith(".js")]

    # Check for include/exclude patterns
    include_patterns = config.get("include", [])
    exclude_patterns = config.get("exclude", [])
    exists_utils = os.path.exists("utils")
    if exists_utils:
        exists_files = [
            file for file in os.listdir("utils") 
            if os.path.isfile(os.path.join("utils", file))
            and file.endswith(".js")
        ]
    else:
        exists_files = []

    no_patterns_set = not include_patterns and not exclude_patterns

    if no_patterns_set and exists_utils:
        files_to_update = exists_files
    elif no_patterns_set:
        files_to_update = utils_list
    elif include_patterns:
        files_to_update = [
            file for file in utils_list
            if any(re.match(pattern, file) for pattern in include_patterns)
            and file.endswith(".js")
        ]
    elif exclude_patterns:

        files_to_update = [
            file for file in utils_list
            if not any(re.match(pattern, file) for pattern in exclude_patterns)
            and file.endswith(".js")
        ]

    print(f"include_patterns: {include_patterns}")
    print(f"exclude_patterns: {exclude_patterns}")
    print(f"exists_utils: {exists_utils}")
    print(f"exists_files: {exists_files}")
    print(f"files_to_update: {files_to_update}")

    # Copy files to utils directory
    os.makedirs("utils", exist_ok=True)

    for file in files_to_update:
        shutil.copy(
            os.path.join(temp_dir, file),
            os.path.join("utils", file)
        )

    # Clean up temp directory   
    if "--no-cleanup" not in sys.argv:
        try:
            shutil.rmtree(temp_dir)
        except PermissionError:
            # On Windows, .git files might be read-only or locked
            # Wait briefly and try again
            import time
            time.sleep(1)
            try:
                # Try using git to clean up if regular deletion fails
                subprocess.run(['git', 'clean', '-fd', temp_dir], check=False)
                shutil.rmtree(temp_dir)
            except PermissionError as e:

                print(f"Warning: Could not remove temporary directory {temp_dir}: {e}")