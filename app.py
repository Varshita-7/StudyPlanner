from flask import Flask, render_template, request, jsonify, session, redirect
import sqlite3
import os
import re
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "database.db")


# =========================================================
# DATABASE
# =========================================================

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db():
    db = get_db()

    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            due_date TEXT NOT NULL,
            time TEXT DEFAULT '',
            completed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE,

            FOREIGN KEY (subject_id)
            REFERENCES subjects(id)
            ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER,
            study_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE,

            FOREIGN KEY (subject_id)
            REFERENCES subjects(id)
            ON DELETE SET NULL
        );
    """)

    db.commit()
    db.close()


# =========================================================
# HELPERS
# =========================================================

def valid_email(email):
    pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    return re.match(pattern, email) is not None


def api_login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        return function(*args, **kwargs)

    return wrapper


def subject_belongs_to_user(db, subject_id, user_id):
    if subject_id is None:
        return True

    row = db.execute(
        """
        SELECT id
        FROM subjects
        WHERE id = ? AND user_id = ?
        """,
        (subject_id, user_id)
    ).fetchone()

    return row is not None


# =========================================================
# AUTHENTICATION PAGES
# =========================================================

@app.route("/")
def index():
    if "user_id" in session:
        return redirect("/dashboard")

    return render_template("index.html")


@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect("/")

    return render_template("dashboard.html")


# =========================================================
# REGISTER
# =========================================================

@app.route("/register", methods=["POST"])
def register():

    data = request.get_json() or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name:
        return jsonify({
            "success": False,
            "message": "Please enter your name."
        }), 400

    if not email or not valid_email(email):
        return jsonify({
            "success": False,
            "message": "Please enter a valid email address."
        }), 400

    if len(password) < 6:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 6 characters."
        }), 400

    db = get_db()

    existing = db.execute(
        "SELECT id FROM users WHERE email = ?",
        (email,)
    ).fetchone()

    if existing:
        db.close()

        return jsonify({
            "success": False,
            "message": "An account with this email already exists."
        }), 409

    hashed_password = generate_password_hash(password)

    cursor = db.execute(
        """
        INSERT INTO users (name, email, password)
        VALUES (?, ?, ?)
        """,
        (name, email, hashed_password)
    )

    user_id = cursor.lastrowid

    db.commit()
    db.close()

    session["user_id"] = user_id
    session["user_name"] = name
    session["user_email"] = email

    return jsonify({
        "success": True,
        "message": "Account created successfully.",
        "redirect": "/dashboard"
    })


# =========================================================
# LOGIN
# =========================================================

@app.route("/login", methods=["POST"])
def login():

    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Please enter email and password."
        }), 400

    db = get_db()

    user = db.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email,)
    ).fetchone()

    db.close()

    if not user:
        return jsonify({
            "success": False,
            "message": "Invalid email or password."
        }), 401

    if not check_password_hash(user["password"], password):
        return jsonify({
            "success": False,
            "message": "Invalid email or password."
        }), 401

    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    session["user_email"] = user["email"]

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "redirect": "/dashboard"
    })


# =========================================================
# LOGOUT
# =========================================================

@app.route("/logout")
def logout():

    session.clear()

    return redirect("/")


# =========================================================
# USER INFORMATION
# =========================================================

@app.route("/api/user", methods=["GET"])
@api_login_required
def get_user():

    db = get_db()

    user = db.execute(
        """
        SELECT id, name, email, created_at
        FROM users
        WHERE id = ?
        """,
        (session["user_id"],)
    ).fetchone()

    db.close()

    if not user:
        session.clear()

        return jsonify({
            "success": False,
            "message": "User not found."
        }), 404

    return jsonify({
        "success": True,
        "user": dict(user)
    })


# =========================================================
# UPDATE USER SETTINGS
# =========================================================

@app.route("/api/user/update", methods=["PUT"])
@api_login_required
def update_user():

    data = request.get_json() or {}

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()

    if not name:
        return jsonify({
            "success": False,
            "message": "Name cannot be empty."
        }), 400

    if not email or not valid_email(email):
        return jsonify({
            "success": False,
            "message": "Please enter a valid email."
        }), 400

    db = get_db()

    existing = db.execute(
        """
        SELECT id
        FROM users
        WHERE email = ? AND id != ?
        """,
        (email, session["user_id"])
    ).fetchone()

    if existing:
        db.close()

        return jsonify({
            "success": False,
            "message": "That email is already being used."
        }), 409

    db.execute(
        """
        UPDATE users
        SET name = ?, email = ?
        WHERE id = ?
        """,
        (name, email, session["user_id"])
    )

    db.commit()
    db.close()

    session["user_name"] = name
    session["user_email"] = email

    return jsonify({
        "success": True,
        "message": "Settings updated successfully."
    })


# =========================================================
# SUBJECTS - GET
# =========================================================

@app.route("/api/subjects", methods=["GET"])
@api_login_required
def get_subjects():

    db = get_db()

    subjects = db.execute(
        """
        SELECT
            s.id,
            s.name,
            s.description,
            s.created_at,
            COUNT(t.id) AS task_count,
            COALESCE(
                SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END),
                0
            ) AS completed_tasks
        FROM subjects s
        LEFT JOIN tasks t
            ON s.id = t.subject_id
        WHERE s.user_id = ?
        GROUP BY s.id
        ORDER BY s.name COLLATE NOCASE
        """,
        (session["user_id"],)
    ).fetchall()

    db.close()

    return jsonify({
        "success": True,
        "subjects": [dict(subject) for subject in subjects]
    })


# =========================================================
# SUBJECTS - ADD
# =========================================================

@app.route("/api/subjects", methods=["POST"])
@api_login_required
def add_subject():

    data = request.get_json() or {}

    name = data.get("name", "").strip()
    description = data.get("description", "").strip()

    if not name:
        return jsonify({
            "success": False,
            "message": "Subject name is required."
        }), 400

    db = get_db()

    existing = db.execute(
        """
        SELECT id
        FROM subjects
        WHERE user_id = ?
        AND LOWER(name) = LOWER(?)
        """,
        (session["user_id"], name)
    ).fetchone()

    if existing:
        db.close()

        return jsonify({
            "success": False,
            "message": "This subject already exists."
        }), 409

    cursor = db.execute(
        """
        INSERT INTO subjects (user_id, name, description)
        VALUES (?, ?, ?)
        """,
        (
            session["user_id"],
            name,
            description
        )
    )

    subject_id = cursor.lastrowid

    db.commit()

    subject = db.execute(
        """
        SELECT *
        FROM subjects
        WHERE id = ?
        """,
        (subject_id,)
    ).fetchone()

    db.close()

    return jsonify({
        "success": True,
        "message": "Subject added successfully.",
        "subject": dict(subject)
    })


# =========================================================
# SUBJECTS - DELETE
# =========================================================

@app.route("/api/subjects/<int:subject_id>", methods=["DELETE"])
@api_login_required
def delete_subject(subject_id):

    db = get_db()

    subject = db.execute(
        """
        SELECT id
        FROM subjects
        WHERE id = ? AND user_id = ?
        """,
        (subject_id, session["user_id"])
    ).fetchone()

    if not subject:
        db.close()

        return jsonify({
            "success": False,
            "message": "Subject not found."
        }), 404

    db.execute(
        """
        DELETE FROM subjects
        WHERE id = ? AND user_id = ?
        """,
        (subject_id, session["user_id"])
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "message": "Subject deleted successfully."
    })


# =========================================================
# TASKS - GET
# =========================================================

@app.route("/api/tasks", methods=["GET"])
@api_login_required
def get_tasks():

    db = get_db()

    tasks = db.execute(
        """
        SELECT
            t.id,
            t.name,
            t.description,
            t.due_date,
            t.time,
            t.completed,
            t.subject_id,
            COALESCE(s.name, 'No Subject') AS subject_name,
            t.created_at
        FROM tasks t
        LEFT JOIN subjects s
            ON t.subject_id = s.id
        WHERE t.user_id = ?
        ORDER BY
            t.completed ASC,
            t.due_date ASC,
            CASE
                WHEN t.time = '' THEN '23:59'
                ELSE t.time
            END ASC,
            t.id DESC
        """,
        (session["user_id"],)
    ).fetchall()

    db.close()

    return jsonify({
        "success": True,
        "tasks": [dict(task) for task in tasks]
    })


# =========================================================
# TASKS - ADD
# =========================================================

@app.route("/api/tasks", methods=["POST"])
@api_login_required
def add_task():

    data = request.get_json() or {}

    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    due_date = data.get("due_date", "").strip()
    task_time = data.get("time", "").strip()
    subject_id = data.get("subject_id")

    if not name:
        return jsonify({
            "success": False,
            "message": "Task name is required."
        }), 400

    if not due_date:
        return jsonify({
            "success": False,
            "message": "Please select a due date."
        }), 400

    if subject_id in ["", None]:
        subject_id = None
    else:
        try:
            subject_id = int(subject_id)
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Invalid subject."
            }), 400

    db = get_db()

    if not subject_belongs_to_user(
        db,
        subject_id,
        session["user_id"]
    ):
        db.close()

        return jsonify({
            "success": False,
            "message": "Invalid subject."
        }), 400

    cursor = db.execute(
        """
        INSERT INTO tasks
        (
            user_id,
            subject_id,
            name,
            description,
            due_date,
            time
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            session["user_id"],
            subject_id,
            name,
            description,
            due_date,
            task_time
        )
    )

    task_id = cursor.lastrowid

    db.commit()

    task = db.execute(
        """
        SELECT
            t.*,
            COALESCE(s.name, 'No Subject') AS subject_name
        FROM tasks t
        LEFT JOIN subjects s
            ON t.subject_id = s.id
        WHERE t.id = ?
        """,
        (task_id,)
    ).fetchone()

    db.close()

    return jsonify({
        "success": True,
        "message": "Task added successfully.",
        "task": dict(task)
    })


# =========================================================
# TASK - TOGGLE COMPLETE
# =========================================================

@app.route("/api/tasks/<int:task_id>/toggle", methods=["PUT"])
@api_login_required
def toggle_task(task_id):

    db = get_db()

    task = db.execute(
        """
        SELECT completed
        FROM tasks
        WHERE id = ? AND user_id = ?
        """,
        (task_id, session["user_id"])
    ).fetchone()

    if not task:
        db.close()

        return jsonify({
            "success": False,
            "message": "Task not found."
        }), 404

    new_status = 0 if task["completed"] else 1

    db.execute(
        """
        UPDATE tasks
        SET completed = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            new_status,
            task_id,
            session["user_id"]
        )
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "completed": bool(new_status)
    })


# =========================================================
# TASK - DELETE
# =========================================================

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@api_login_required
def delete_task(task_id):

    db = get_db()

    task = db.execute(
        """
        SELECT id
        FROM tasks
        WHERE id = ? AND user_id = ?
        """,
        (task_id, session["user_id"])
    ).fetchone()

    if not task:
        db.close()

        return jsonify({
            "success": False,
            "message": "Task not found."
        }), 404

    db.execute(
        """
        DELETE FROM tasks
        WHERE id = ? AND user_id = ?
        """,
        (task_id, session["user_id"])
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "message": "Task deleted successfully."
    })


# =========================================================
# SCHEDULE - GET
# =========================================================

@app.route("/api/schedule", methods=["GET"])
@api_login_required
def get_schedule():

    db = get_db()

    schedules = db.execute(
        """
        SELECT
            sc.id,
            sc.subject_id,
            COALESCE(s.name, 'Study Session') AS subject_name,
            sc.study_date,
            sc.start_time,
            sc.end_time,
            sc.created_at
        FROM schedules sc
        LEFT JOIN subjects s
            ON sc.subject_id = s.id
        WHERE sc.user_id = ?
        ORDER BY
            sc.study_date ASC,
            sc.start_time ASC,
            sc.id DESC
        """,
        (session["user_id"],)
    ).fetchall()

    db.close()

    return jsonify({
        "success": True,
        "schedule": [dict(item) for item in schedules]
    })


# =========================================================
# SCHEDULE - ADD
# =========================================================

@app.route("/api/schedule", methods=["POST"])
@api_login_required
def add_schedule():

    data = request.get_json() or {}

    subject_id = data.get("subject_id")
    study_date = data.get("study_date", "").strip()
    start_time = data.get("start_time", "").strip()
    end_time = data.get("end_time", "").strip()

    if not study_date:
        return jsonify({
            "success": False,
            "message": "Please select a date."
        }), 400

    if not start_time or not end_time:
        return jsonify({
            "success": False,
            "message": "Please select start and end time."
        }), 400

    if start_time >= end_time:
        return jsonify({
            "success": False,
            "message": "End time must be after start time."
        }), 400

    if subject_id in ["", None]:
        subject_id = None
    else:
        try:
            subject_id = int(subject_id)
        except (ValueError, TypeError):
            return jsonify({
                "success": False,
                "message": "Invalid subject."
            }), 400

    db = get_db()

    if not subject_belongs_to_user(
        db,
        subject_id,
        session["user_id"]
    ):
        db.close()

        return jsonify({
            "success": False,
            "message": "Invalid subject."
        }), 400

    cursor = db.execute(
        """
        INSERT INTO schedules
        (
            user_id,
            subject_id,
            study_date,
            start_time,
            end_time
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            session["user_id"],
            subject_id,
            study_date,
            start_time,
            end_time
        )
    )

    schedule_id = cursor.lastrowid

    db.commit()

    schedule = db.execute(
        """
        SELECT
            sc.*,
            COALESCE(s.name, 'Study Session') AS subject_name
        FROM schedules sc
        LEFT JOIN subjects s
            ON sc.subject_id = s.id
        WHERE sc.id = ?
        """,
        (schedule_id,)
    ).fetchone()

    db.close()

    return jsonify({
        "success": True,
        "message": "Study session added successfully.",
        "schedule": dict(schedule)
    })


# =========================================================
# SCHEDULE - DELETE
# =========================================================

@app.route("/api/schedule/<int:schedule_id>", methods=["DELETE"])
@api_login_required
def delete_schedule(schedule_id):

    db = get_db()

    item = db.execute(
        """
        SELECT id
        FROM schedules
        WHERE id = ? AND user_id = ?
        """,
        (schedule_id, session["user_id"])
    ).fetchone()

    if not item:
        db.close()

        return jsonify({
            "success": False,
            "message": "Schedule not found."
        }), 404

    db.execute(
        """
        DELETE FROM schedules
        WHERE id = ? AND user_id = ?
        """,
        (schedule_id, session["user_id"])
    )

    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "message": "Study session deleted successfully."
    })


# =========================================================
# START APPLICATION
# =========================================================

init_db()

if __name__ == "__main__":
    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )