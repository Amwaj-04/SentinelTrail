"""
watcher.py
----------
Watches a target directory (demo_target/ by default) for real filesystem
activity and feeds every create/modify/delete/move event into the
hash-chained Evidence Trail (see chain.py).

This is the "sensor" half of the project; chain.py is the "forensic" half.
"""

import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

import chain


class EvidenceHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            chain.append_event("CREATED", event.src_path, "File created")

    def on_modified(self, event):
        if not event.is_directory:
            chain.append_event("MODIFIED", event.src_path, "File contents or metadata changed")

    def on_deleted(self, event):
        if not event.is_directory:
            chain.append_event("DELETED", event.src_path, "File deleted")

    def on_moved(self, event):
        if not event.is_directory:
            chain.append_event("MOVED", event.dest_path, f"Renamed/moved from {event.src_path}")


_observer = None
_lock = threading.Lock()


def start_watching(path):
    """Idempotent: safe to call multiple times (e.g. Flask debug reloader)."""
    global _observer
    with _lock:
        if _observer is not None:
            return _observer
        handler = EvidenceHandler()
        observer = Observer()
        observer.schedule(handler, path, recursive=True)
        observer.start()
        _observer = observer
        return observer


def stop_watching():
    global _observer
    with _lock:
        if _observer:
            _observer.stop()
            _observer.join()
            _observer = None


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "demo_target"
    print(f"Watching {target} ... Ctrl+C to stop")
    start_watching(target)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_watching()
