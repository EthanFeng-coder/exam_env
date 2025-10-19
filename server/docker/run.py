import os
import sys

code = os.environ.get('CODE', '')
if code:
    try:
        exec(code)
    except Exception as e:
        print(f"{type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)