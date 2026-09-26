extends CharacterBody2D

const SPEED := 200.0

func _enter_tree() -> void:
	set_multiplayer_authority(int(str(name)))

func _ready() -> void:
	var visual := ColorRect.new()
	visual.color = Color(0.2, 0.6, 1.0)
	visual.size = Vector2(32, 32)
	visual.position = Vector2(-16, -16)
	add_child(visual)

	var collision := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 16.0
	collision.shape = shape
	add_child(collision)

	var label := Label.new()
	label.text = "Player %s" % name
	label.position = Vector2(-30, -40)
	add_child(label)

	var camera := Camera2D.new()
	camera.enabled = is_multiplayer_authority()
	add_child(camera)

	var sync := MultiplayerSynchronizer.new()
	var config := SceneReplicationConfig.new()
	config.add_property(NodePath(".:position"))
	sync.replication_config = config
	add_child(sync)

func _physics_process(_delta: float) -> void:
	if not is_multiplayer_authority():
		return

	var input_vector := Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	)
	velocity = input_vector.normalized() * SPEED
	move_and_slide()
