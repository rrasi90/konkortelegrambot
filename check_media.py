import os
media_path = r'C:\Users\rrasi_oorj8fq\AppData\Roaming\Anki2\User 1\collection.media'
files = os.listdir(media_path) if os.path.exists(media_path) else []
print(f"Media files count: {len(files)}")
for f in sorted(files)[:20]:
    size = os.path.getsize(os.path.join(media_path, f))
    print(f"  {f}  ({size} bytes)")
