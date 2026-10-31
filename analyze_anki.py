import sqlite3, os, shutil
path = r'C:\Users\rrasi_oorj8fq\AppData\Roaming\Anki2\User 1\collection.anki2'
print('DB exists:', os.path.exists(path))
if os.path.exists(path):
    import shutil
    tmp = r'C:\Users\rrasi_oorj8fq\AppData\Local\Temp\anki_tmp.anki2'
    shutil.copy2(path, tmp)
    conn = sqlite3.connect(tmp)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print('Tables count:', len(tables))
    print('All tables:', sorted(tables))
    for t in ['notes', 'cards', 'col', 'deck_config', 'review_log', 'revlog']:
        if t in tables:
            cursor.execute(f"SELECT * FROM {t} LIMIT 2")
            desc = cursor.description
            col_names = [d[0] for d in desc] if desc else []
            row = cursor.fetchone()
            with open('anki_sample_output.txt', 'a', encoding='utf-8') as out:
                out.write(f"Table '{t}' columns: {col_names}\n")
                if row:
                    out.write(f"  Sample: {str(row)[:400]}\n")
            print(f"Table '{t}' written")
