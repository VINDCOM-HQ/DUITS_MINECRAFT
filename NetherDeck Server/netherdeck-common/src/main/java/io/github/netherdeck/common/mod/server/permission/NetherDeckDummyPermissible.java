package io.github.netherdeck.common.mod.server.permission;

import org.bukkit.permissions.PermissibleBase;
import org.bukkit.permissions.ServerOperator;

public class NetherDeckDummyPermissible extends PermissibleBase {

    public static final ServerOperator DUMMY_OPERATOR = new ServerOperator() {
        @Override
        public boolean isOp() {
            return false;
        }

        @Override
        public void setOp(boolean b) {}
    };
    public NetherDeckDummyPermissible() {
        super(DUMMY_OPERATOR);
    }
}
