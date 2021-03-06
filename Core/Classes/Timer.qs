@info: Timer capable of measuring time intervals, which are marked by firing the Timer's .tick event.
@ns: Core
def Class Timer
    @info: Counter of all happened ticks
    public Number counter: 0

    @info: Switch timer enabled flag to true and start firing .tick event
    public Function start

    @info: Switch timer enabled flag to false and stop firing .tick event
    public Function stop

    @info: Flag defining whether this timer is enabled (started).
    public Boolean enabled: false

    @info: The timer interval in milliseconds
    public Number interval

    @arg: time
      Current time
    @info: Timer reactive property that change it value to true and than immediately to false on every .tick event
    public Event tick